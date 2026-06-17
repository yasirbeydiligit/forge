/**
 * Ingestion orchestrator for the Research Library RAG pipeline:
 * parse → chunk → embed → store, with idempotency and status tracking.
 *
 * SERVER-ONLY in production (writes via the service-role Supabase client), but
 * this module imports neither `ragEnv` nor `server-only` so it stays
 * unit-testable. All side-effecting collaborators are injected:
 *   - `adminClient`: a service-role Supabase client (DB writes)
 *   - `embed`: a function that embeds chunk texts (prod wires
 *     `(t) => embedDocuments(t, ragEnv.voyageApiKey)`)
 * `parsePdf` and `chunkPages` are pure imports.
 */

import { createHash } from "node:crypto";

import { chunkPages } from "./chunk";
import { estimateTokens } from "./chunk";
import { parsePdf } from "./parse";

const EMBEDDING_DIM = 1024;

export type IngestMeta = {
  title: string;
  authors?: string | null;
  source_type: "paper" | "book" | "handout";
  source_url?: string | null;
  doi?: string | null;
  year?: number | null;
  license?: string | null;
  storage_path?: string | null;
  page_count?: number | null;
  uploaded_by?: string | null;
};

/** The shape of a `library_documents` row we read/return. */
export type LibraryDocumentRow = {
  id: string;
  status: string;
  content_hash: string | null;
  doi: string | null;
  [key: string]: unknown;
};

/**
 * Minimal structural type for the bits of the Supabase client we use. Keeping
 * it structural (rather than `SupabaseClient<Database>`) makes the orchestrator
 * trivial to mock in unit tests while staying compatible with the real client.
 */
export type IngestAdminClient = {
  from: (table: string) => {
    select: (columns?: string) => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        eq: (column: string, value: unknown) => {
          maybeSingle: () => Promise<{ data: LibraryDocumentRow | null; error: unknown }>;
        };
        maybeSingle: () => Promise<{ data: LibraryDocumentRow | null; error: unknown }>;
      };
    };
    insert: (rows: unknown) =>
      | Promise<{ data: unknown; error: unknown }>
      | {
          select: (columns?: string) => {
            single: () => Promise<{ data: LibraryDocumentRow | null; error: unknown }>;
          };
        };
    update: (values: unknown) => {
      eq: (column: string, value: unknown) => Promise<{ data: unknown; error: unknown }>;
    };
    delete: () => {
      eq: (
        column: string,
        value: unknown,
      ) => {
        neq: (
          column: string,
          value: unknown,
        ) => Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
};

export type IngestArgs = {
  adminClient: IngestAdminClient;
  meta: IngestMeta;
  pdfBuffer: Uint8Array | ArrayBuffer | Buffer;
  embed: (texts: string[]) => Promise<number[][]>;
};

/** sha256 hex digest of the PDF bytes — used as the content hash for dedup. */
function sha256Hex(data: Uint8Array | ArrayBuffer | Buffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return createHash("sha256").update(bytes).digest("hex");
}

/** Format a vector as a pgvector text literal: "[1,2,3]". */
function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

function unwrap<T>(result: { data: T; error: unknown }, context: string): T {
  if (result.error) {
    const msg =
      typeof result.error === "object" && result.error && "message" in result.error
        ? String((result.error as { message: unknown }).message)
        : String(result.error);
    throw new Error(`${context}: ${msg}`);
  }
  return result.data;
}

/**
 * Ingest one PDF document: dedup, insert as `processing`, parse → chunk →
 * embed, bulk-insert chunks (embeddings as pgvector string literals), then
 * mark `ready`. On any error, mark the document `failed` (with the message)
 * and rethrow. Returns the document row.
 */
export async function ingestDocument(
  args: IngestArgs,
): Promise<LibraryDocumentRow> {
  const { adminClient, meta, pdfBuffer, embed } = args;
  const contentHash = sha256Hex(pdfBuffer);

  // 1) Idempotency + re-run safety. `content_hash` (and `doi`) carry a UNIQUE
  //    constraint, so we must reconcile against ANY existing row — not just
  //    `ready` ones — before inserting. For a given identifier:
  //      - a `ready` row means we've already ingested this → return it untouched;
  //      - a non-ready row (a prior `failed`/`processing` attempt) would collide
  //        on the UNIQUE constraint, so we DELETE it first (its chunks
  //        cascade-delete via the FK) and then re-ingest from scratch.
  const byHash = await adminClient
    .from("library_documents")
    .select("*")
    .eq("content_hash", contentHash)
    .maybeSingle();
  const existingByHash = unwrap(byHash, "Mevcut belge kontrolü (content_hash) başarısız");
  if (existingByHash) {
    if (existingByHash.status === "ready") return existingByHash;
    unwrap(
      await adminClient
        .from("library_documents")
        .delete()
        .eq("content_hash", contentHash)
        .neq("status", "ready"),
      "Eski (hazır olmayan) belge silinemedi (content_hash)",
    );
  }

  if (meta.doi) {
    const byDoi = await adminClient
      .from("library_documents")
      .select("*")
      .eq("doi", meta.doi)
      .maybeSingle();
    const existingByDoi = unwrap(byDoi, "Mevcut belge kontrolü (doi) başarısız");
    if (existingByDoi) {
      if (existingByDoi.status === "ready") return existingByDoi;
      unwrap(
        await adminClient
          .from("library_documents")
          .delete()
          .eq("doi", meta.doi)
          .neq("status", "ready"),
        "Eski (hazır olmayan) belge silinemedi (doi)",
      );
    }
  }

  // 2) Insert the document row as `processing` and capture its id.
  const insertResult = adminClient.from("library_documents").insert({
    title: meta.title,
    authors: meta.authors ?? null,
    source_type: meta.source_type,
    source_url: meta.source_url ?? null,
    doi: meta.doi ?? null,
    year: meta.year ?? null,
    license: meta.license ?? null,
    storage_path: meta.storage_path ?? null,
    page_count: meta.page_count ?? null,
    uploaded_by: meta.uploaded_by ?? null,
    content_hash: contentHash,
    status: "processing",
  });
  // insert(...).select("*").single() — the established pattern in this codebase.
  if (!("select" in insertResult)) {
    throw new Error("Belge eklenemedi: beklenmeyen istemci yanıtı");
  }
  const doc = unwrap(
    await insertResult.select("*").single(),
    "Belge eklenemedi (processing)",
  );
  if (!doc) throw new Error("Belge eklenemedi: satır döndürülmedi");

  try {
    // 3) Parse → chunk → embed.
    const pages = await parsePdf(pdfBuffer);
    const pageCount = pages.length;
    const chunks = chunkPages(pages);

    let embeddings: number[][] = [];
    if (chunks.length > 0) {
      embeddings = await embed(chunks.map((c) => c.content));
      if (embeddings.length !== chunks.length) {
        throw new Error(
          `Embedding sayısı parça sayısıyla uyuşmuyor: ${embeddings.length} ≠ ${chunks.length}`,
        );
      }
      for (const e of embeddings) {
        if (e.length !== EMBEDDING_DIM) {
          throw new Error(
            `Beklenmeyen embedding boyutu: ${e.length} (beklenen ${EMBEDDING_DIM})`,
          );
        }
      }
    }

    // 4) Bulk-insert chunks. The vector column MUST be a pgvector text literal
    //    ("[...]"), not a raw JS array — PostgREST won't coerce JSON arrays.
    if (chunks.length > 0) {
      const rows = chunks.map((chunk, i) => ({
        document_id: doc.id,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber,
        char_start: chunk.charStart,
        char_end: chunk.charEnd,
        content: chunk.content,
        token_count: estimateTokens(chunk.content),
        embedding: toPgVector(embeddings[i]),
      }));
      const chunkInsert = adminClient.from("document_chunks").insert(rows);
      const chunkResult = await ("select" in chunkInsert ? chunkInsert.select() : chunkInsert);
      unwrap(chunkResult as { data: unknown; error: unknown }, "Parçalar eklenemedi");
    }

    // 5) Mark ready (and persist the real page count).
    unwrap(
      await adminClient
        .from("library_documents")
        .update({ status: "ready", page_count: pageCount, error: null })
        .eq("id", doc.id),
      "Belge durumu güncellenemedi (ready)",
    );

    return { ...doc, status: "ready", page_count: pageCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Best-effort: flag the document failed; don't mask the original error.
    try {
      await adminClient
        .from("library_documents")
        .update({ status: "failed", error: message })
        .eq("id", doc.id);
    } catch {
      // swallow — we rethrow the original error below
    }
    throw err;
  }
}

export { sha256Hex, toPgVector };
