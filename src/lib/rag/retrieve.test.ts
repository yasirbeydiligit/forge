import { describe, it, expect, vi } from "vitest";

import { searchLibrary, type RetrieveClient } from "./retrieve";

/** One match_chunks row (snake_case) with sensible defaults; override per test. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    chunk_id: "chunk-1",
    document_id: "doc-1",
    chunk_index: 3,
    page_number: 12,
    char_start: 100,
    char_end: 250,
    section_title: "Hypertrophy",
    content: "Mechanical tension drives hypertrophy.",
    document_title: "Strength Training Anatomy",
    document_authors: "Frederic Delavier",
    document_source_url: "https://example.com/doc-1",
    document_year: 2010,
    score: 0.87,
    ...overrides,
  };
}

/** A mock Supabase client whose rpc() resolves with the given data/error. */
function makeClient(result: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue({
    data: result.data ?? null,
    error: result.error ?? null,
  });
  return { client: { rpc } as unknown as RetrieveClient, rpc };
}

describe("searchLibrary", () => {
  it("embeds the query and calls match_chunks with the pgvector-string embedding, query_text and match_count", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2, 0.3]);
    const { client, rpc } = makeClient({ data: [] });

    await searchLibrary({ supabase: client, embedQuery, query: "squat depth", k: 5 });

    expect(embedQuery).toHaveBeenCalledWith("squat depth");
    expect(rpc).toHaveBeenCalledOnce();
    const [fn, args] = rpc.mock.calls[0];
    expect(fn).toBe("match_chunks");
    expect(args).toEqual({
      query_embedding: "[0.1,0.2,0.3]",
      query_text: "squat depth",
      match_count: 5,
    });
  });

  it("defaults match_count to 8 when k is omitted", async () => {
    const embedQuery = vi.fn().mockResolvedValue([1, 2]);
    const { client, rpc } = makeClient({ data: [] });

    await searchLibrary({ supabase: client, embedQuery, query: "q" });

    expect(rpc.mock.calls[0][1].match_count).toBe(8);
  });

  it("maps snake_case rows to the typed camelCase RetrievedChunk shape", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.5]);
    const { client } = makeClient({ data: [row()] });

    const result = await searchLibrary({ supabase: client, embedQuery, query: "q" });

    expect(result).toEqual([
      {
        chunkId: "chunk-1",
        documentId: "doc-1",
        chunkIndex: 3,
        pageNumber: 12,
        charStart: 100,
        charEnd: 250,
        sectionTitle: "Hypertrophy",
        content: "Mechanical tension drives hypertrophy.",
        documentTitle: "Strength Training Anatomy",
        documentAuthors: "Frederic Delavier",
        documentSourceUrl: "https://example.com/doc-1",
        documentYear: 2010,
        score: 0.87,
      },
    ]);
  });

  it("preserves nullable columns (page_number, section_title, authors, url, year)", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.5]);
    const { client } = makeClient({
      data: [
        row({
          page_number: null,
          section_title: null,
          document_authors: null,
          document_source_url: null,
          document_year: null,
        }),
      ],
    });

    const [chunk] = await searchLibrary({ supabase: client, embedQuery, query: "q" });

    expect(chunk.pageNumber).toBeNull();
    expect(chunk.sectionTitle).toBeNull();
    expect(chunk.documentAuthors).toBeNull();
    expect(chunk.documentSourceUrl).toBeNull();
    expect(chunk.documentYear).toBeNull();
  });

  it("returns [] when the RPC returns null data", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.5]);
    const { client } = makeClient({ data: null });

    const result = await searchLibrary({ supabase: client, embedQuery, query: "q" });
    expect(result).toEqual([]);
  });

  it("throws a clear error when the RPC returns an error", async () => {
    const embedQuery = vi.fn().mockResolvedValue([0.5]);
    const { client } = makeClient({ error: { message: "rpc boom" } });

    await expect(
      searchLibrary({ supabase: client, embedQuery, query: "q" }),
    ).rejects.toThrow(/Kütüphane araması başarısız: rpc boom/);
  });
});
