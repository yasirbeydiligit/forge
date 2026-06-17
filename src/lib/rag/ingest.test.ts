import { describe, it, expect, vi, beforeEach } from "vitest";

// Control parse + chunk so we don't need a real PDF.
const parsePdf = vi.fn();
const chunkPages = vi.fn();

vi.mock("./parse", () => ({ parsePdf: (...a: unknown[]) => parsePdf(...a) }));
vi.mock("./chunk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./chunk")>();
  return {
    ...actual,
    chunkPages: (...a: unknown[]) => chunkPages(...a),
  };
});

import {
  ingestDocument,
  sha256Hex,
  type IngestMeta,
  type IngestAdminClient,
} from "./ingest";

type Captured = {
  selectEqArgs: [string, unknown][];
  documentInserts: Record<string, unknown>[];
  chunkInserts: Record<string, unknown>[][];
  updates: { values: Record<string, unknown>; id: unknown }[];
  deletes: { eq: [string, unknown]; neq: [string, unknown] }[];
};

/**
 * Build a fake admin client.
 *
 * The dedup step now looks up an existing `library_documents` row by
 * `content_hash` (and, when set, by `doi`) regardless of status:
 *   - `existing` is the row returned by those `select().eq().maybeSingle()`
 *     lookups (null = nothing exists);
 *   - a `ready` row short-circuits and is returned untouched;
 *   - a non-ready row is DELETE-d (captured in `deletes`) before re-ingesting.
 *
 * The inserted document row is returned from insert().select().single() with a
 * fixed id.
 */
function makeAdmin(opts: {
  existing?: Record<string, unknown> | null;
  insertedId?: string;
} = {}) {
  const captured: Captured = {
    selectEqArgs: [],
    documentInserts: [],
    chunkInserts: [],
    updates: [],
    deletes: [],
  };
  const insertedId = opts.insertedId ?? "doc-1";

  const client = {
    from(table: string) {
      return {
        select() {
          const eqChain = {
            eq(column: string, value: unknown) {
              captured.selectEqArgs.push([column, value]);
              return {
                eq(c2: string, v2: unknown) {
                  captured.selectEqArgs.push([c2, v2]);
                  return {
                    async maybeSingle() {
                      return { data: opts.existing ?? null, error: null };
                    },
                  };
                },
                async maybeSingle() {
                  return { data: opts.existing ?? null, error: null };
                },
              };
            },
          };
          return eqChain;
        },
        delete() {
          return {
            eq(column: string, value: unknown) {
              return {
                async neq(neqColumn: string, neqValue: unknown) {
                  captured.deletes.push({
                    eq: [column, value],
                    neq: [neqColumn, neqValue],
                  });
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        insert(rows: unknown) {
          if (table === "document_chunks") {
            captured.chunkInserts.push(rows as Record<string, unknown>[]);
            // chunk insert may be awaited directly OR have .select()
            const result = { data: null, error: null };
            return Object.assign(Promise.resolve(result), {
              select: () => Promise.resolve(result),
            });
          }
          captured.documentInserts.push(rows as Record<string, unknown>);
          return {
            select() {
              return {
                async single() {
                  return {
                    data: {
                      id: insertedId,
                      status: "processing",
                      content_hash: (rows as Record<string, unknown>).content_hash,
                      doi: (rows as Record<string, unknown>).doi ?? null,
                      title: (rows as Record<string, unknown>).title,
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
        update(values: unknown) {
          return {
            async eq(_column: string, value: unknown) {
              captured.updates.push({
                values: values as Record<string, unknown>,
                id: value,
              });
              return { data: null, error: null };
            },
          };
        },
      };
    },
  };

  // The mock is a structural stand-in for the Supabase client; cast through
  // `unknown` so the hand-built doubles satisfy IngestAdminClient without
  // weakening the production type.
  return { client: client as unknown as IngestAdminClient, captured };
}

const meta: IngestMeta = {
  title: "Test Paper",
  authors: "A. Author",
  source_type: "paper",
  source_url: "https://example.com/p.pdf",
  doi: "10.1/abc",
  year: 2024,
  license: "CC-BY",
  storage_path: "library/p.pdf",
};

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 1, 2, 3]);

function vec(fill: number) {
  return Array.from({ length: 1024 }, () => fill);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ingestDocument", () => {
  it("transitions processing → ready on success and inserts chunks", async () => {
    parsePdf.mockResolvedValue([
      { pageNumber: 1, text: "page one" },
      { pageNumber: 2, text: "page two" },
    ]);
    chunkPages.mockReturnValue([
      { chunkIndex: 0, pageNumber: 1, charStart: 0, charEnd: 8, content: "page one" },
      { chunkIndex: 1, pageNumber: 2, charStart: 0, charEnd: 8, content: "page two" },
    ]);
    const embed = vi.fn().mockResolvedValue([vec(0.1), vec(0.2)]);
    const { client, captured } = makeAdmin();

    const result = await ingestDocument({ adminClient: client, meta, pdfBuffer: pdf, embed });

    // inserted as processing
    expect(captured.documentInserts[0].status).toBe("processing");
    expect(captured.documentInserts[0].content_hash).toBe(sha256Hex(pdf));
    // embed called with the chunk contents
    expect(embed).toHaveBeenCalledWith(["page one", "page two"]);
    // final update flips to ready with the real page count
    const ready = captured.updates.find((u) => u.values.status === "ready");
    expect(ready).toBeDefined();
    expect(ready!.values.page_count).toBe(2);
    expect(ready!.id).toBe("doc-1");
    expect(result.status).toBe("ready");
  });

  it("formats each chunk embedding as a pgvector string literal, not a JS array", async () => {
    parsePdf.mockResolvedValue([{ pageNumber: 1, text: "x" }]);
    chunkPages.mockReturnValue([
      { chunkIndex: 0, pageNumber: 1, charStart: 0, charEnd: 1, content: "x" },
    ]);
    const embed = vi.fn().mockResolvedValue([[1, 2, 3, ...Array(1021).fill(0)]]);
    const { client, captured } = makeAdmin();

    await ingestDocument({ adminClient: client, meta, pdfBuffer: pdf, embed });

    const chunkRow = captured.chunkInserts[0][0];
    expect(typeof chunkRow.embedding).toBe("string");
    expect(chunkRow.embedding as string).toMatch(/^\[1,2,3,/);
    expect(chunkRow.embedding as string).toMatch(/\]$/);
    // carries page + offset + index + token_count
    expect(chunkRow.document_id).toBe("doc-1");
    expect(chunkRow.chunk_index).toBe(0);
    expect(chunkRow.page_number).toBe(1);
    expect(chunkRow.char_start).toBe(0);
    expect(chunkRow.char_end).toBe(1);
    expect(chunkRow.token_count).toBe(1);
  });

  it("is idempotent: skips and returns the existing ready doc with the same content_hash", async () => {
    const existing = {
      id: "existing-1",
      status: "ready",
      content_hash: sha256Hex(pdf),
      doi: null,
    };
    const embed = vi.fn();
    const { client, captured } = makeAdmin({ existing });

    const result = await ingestDocument({ adminClient: client, meta: { ...meta, doi: null }, pdfBuffer: pdf, embed });

    expect(result).toBe(existing);
    expect(captured.documentInserts).toHaveLength(0);
    expect(captured.chunkInserts).toHaveLength(0);
    expect(captured.deletes).toHaveLength(0);
    expect(parsePdf).not.toHaveBeenCalled();
    expect(embed).not.toHaveBeenCalled();
    // looked up by content_hash (regardless of status)
    expect(captured.selectEqArgs).toContainEqual(["content_hash", sha256Hex(pdf)]);
  });

  it("re-ingests over a non-ready existing row matched by content_hash: deletes it first, then ingests to ready", async () => {
    const stale = {
      id: "stale-1",
      status: "failed",
      content_hash: sha256Hex(pdf),
      doi: null,
    };
    parsePdf.mockResolvedValue([{ pageNumber: 1, text: "page one" }]);
    chunkPages.mockReturnValue([
      { chunkIndex: 0, pageNumber: 1, charStart: 0, charEnd: 8, content: "page one" },
    ]);
    const embed = vi.fn().mockResolvedValue([vec(0.1)]);
    const { client, captured } = makeAdmin({ existing: stale });

    const result = await ingestDocument({
      adminClient: client,
      meta: { ...meta, doi: null },
      pdfBuffer: pdf,
      embed,
    });

    // the stale (non-ready) row was deleted by content_hash, scoped to non-ready
    expect(captured.deletes).toContainEqual({
      eq: ["content_hash", sha256Hex(pdf)],
      neq: ["status", "ready"],
    });
    // then a fresh row was inserted as processing and brought to ready
    expect(captured.documentInserts).toHaveLength(1);
    expect(captured.documentInserts[0].status).toBe("processing");
    expect(embed).toHaveBeenCalledOnce();
    expect(result.status).toBe("ready");
  });

  it("re-ingests over a non-ready existing row matched by doi: deletes it first, then ingests to ready", async () => {
    const stale = {
      id: "stale-doi-1",
      status: "processing",
      content_hash: "some-other-hash",
      doi: meta.doi ?? null,
    };
    parsePdf.mockResolvedValue([{ pageNumber: 1, text: "page one" }]);
    chunkPages.mockReturnValue([
      { chunkIndex: 0, pageNumber: 1, charStart: 0, charEnd: 8, content: "page one" },
    ]);
    const embed = vi.fn().mockResolvedValue([vec(0.1)]);
    const { client, captured } = makeAdmin({ existing: stale });

    const result = await ingestDocument({
      adminClient: client,
      meta, // meta.doi is set
      pdfBuffer: pdf,
      embed,
    });

    // both lookups (content_hash + doi) return the same stale row in this mock,
    // so both delete the non-ready row; assert the doi-scoped delete happened.
    expect(captured.deletes).toContainEqual({
      eq: ["doi", meta.doi],
      neq: ["status", "ready"],
    });
    expect(captured.documentInserts).toHaveLength(1);
    expect(result.status).toBe("ready");
  });

  it("returns the existing ready doc matched by doi (no insert, no delete)", async () => {
    const existing = {
      id: "ready-doi-1",
      status: "ready",
      content_hash: "different-hash-than-this-pdf",
      doi: meta.doi ?? null,
    };
    const embed = vi.fn();
    const { client, captured } = makeAdmin({ existing });

    const result = await ingestDocument({ adminClient: client, meta, pdfBuffer: pdf, embed });

    expect(result).toBe(existing);
    expect(captured.documentInserts).toHaveLength(0);
    expect(captured.deletes).toHaveLength(0);
    expect(embed).not.toHaveBeenCalled();
  });

  it("transitions processing → failed on a parse error and rethrows", async () => {
    parsePdf.mockRejectedValue(new Error("corrupt pdf"));
    const embed = vi.fn();
    const { client, captured } = makeAdmin();

    await expect(
      ingestDocument({ adminClient: client, meta, pdfBuffer: pdf, embed }),
    ).rejects.toThrow("corrupt pdf");

    const failed = captured.updates.find((u) => u.values.status === "failed");
    expect(failed).toBeDefined();
    expect(failed!.values.error).toBe("corrupt pdf");
    expect(captured.updates.some((u) => u.values.status === "ready")).toBe(false);
  });

  it("transitions to failed when embed returns the wrong count", async () => {
    parsePdf.mockResolvedValue([{ pageNumber: 1, text: "a b" }]);
    chunkPages.mockReturnValue([
      { chunkIndex: 0, pageNumber: 1, charStart: 0, charEnd: 1, content: "a" },
      { chunkIndex: 1, pageNumber: 1, charStart: 2, charEnd: 3, content: "b" },
    ]);
    const embed = vi.fn().mockResolvedValue([vec(0.1)]); // 1 != 2
    const { client, captured } = makeAdmin();

    await expect(
      ingestDocument({ adminClient: client, meta, pdfBuffer: pdf, embed }),
    ).rejects.toThrow(/uyuşmuyor/);

    expect(captured.updates.some((u) => u.values.status === "failed")).toBe(true);
  });

  it("transitions to failed when an embedding has the wrong dimension", async () => {
    parsePdf.mockResolvedValue([{ pageNumber: 1, text: "a" }]);
    chunkPages.mockReturnValue([
      { chunkIndex: 0, pageNumber: 1, charStart: 0, charEnd: 1, content: "a" },
    ]);
    const embed = vi.fn().mockResolvedValue([[1, 2, 3]]); // not 1024-dim
    const { client } = makeAdmin();

    await expect(
      ingestDocument({ adminClient: client, meta, pdfBuffer: pdf, embed }),
    ).rejects.toThrow(/embedding boyutu/);
  });

  it("handles a document with no chunks (empty PDF) without embedding or inserting chunks", async () => {
    parsePdf.mockResolvedValue([]);
    chunkPages.mockReturnValue([]);
    const embed = vi.fn();
    const { client, captured } = makeAdmin();

    const result = await ingestDocument({ adminClient: client, meta, pdfBuffer: pdf, embed });

    expect(embed).not.toHaveBeenCalled();
    expect(captured.chunkInserts).toHaveLength(0);
    expect(result.status).toBe("ready");
    expect(captured.updates.find((u) => u.values.status === "ready")!.values.page_count).toBe(0);
  });
});
