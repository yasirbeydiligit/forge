/**
 * Retrieval helper for the Research Library RAG pipeline.
 *
 * `searchLibrary` embeds a user query, then calls the `match_chunks` Postgres
 * RPC (pgvector cosine + lexical hybrid) and maps the snake_case rows it
 * returns into a typed, camelCase shape.
 *
 * SERVER-ONLY in production (the Supabase client carries the user JWT, so RLS
 * is the source of truth), but this module imports neither `ragEnv` nor
 * `server-only` so it stays unit-testable: the Supabase client and the embed
 * function are both injected. Production callers pass the request-scoped
 * `@supabase/ssr` client and `(q) => embedQuery(q, ragEnv.voyageApiKey)`.
 */

export type RetrievedChunk = {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number | null;
  charStart: number;
  charEnd: number;
  sectionTitle: string | null;
  content: string;
  documentTitle: string;
  documentAuthors: string | null;
  documentSourceUrl: string | null;
  documentYear: number | null;
  score: number;
};

/** The snake_case row shape returned by the `match_chunks` RPC. */
type MatchChunkRow = {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  page_number: number | null;
  char_start: number;
  char_end: number;
  section_title: string | null;
  content: string;
  document_title: string;
  document_authors: string | null;
  document_source_url: string | null;
  document_year: number | null;
  score: number;
};

/**
 * Minimal structural type for the bit of the Supabase client we use. Keeping it
 * structural (rather than `SupabaseClient<Database>`) makes it trivial to mock
 * in unit tests while staying compatible with the real client.
 */
export type RetrieveClient = {
  rpc: (
    fn: "match_chunks",
    args: { query_embedding: string; query_text: string; match_count: number },
  ) => Promise<{ data: MatchChunkRow[] | null; error: unknown }>;
};

export type SearchLibraryArgs = {
  supabase: RetrieveClient;
  embedQuery: (query: string) => Promise<number[]>;
  query: string;
  k?: number;
};

/** Format a vector as a pgvector text literal: "[1,2,3]". */
function toPgVector(values: number[]): string {
  return `[${values.join(",")}]`;
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Embed `query`, call `match_chunks` for the top-`k` chunks, and return them in
 * the typed `RetrievedChunk` shape. Throws if the RPC returns an error.
 */
export async function searchLibrary({
  supabase,
  embedQuery,
  query,
  k = 8,
}: SearchLibraryArgs): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(query);

  // The vector arg MUST be a pgvector text literal ("[...]"), not a raw JS
  // array — PostgREST won't coerce a JSON array to a pgvector.
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: toPgVector(embedding),
    query_text: query,
    match_count: k,
  });

  if (error) {
    throw new Error(`Kütüphane araması başarısız: ${errorMessage(error)}`);
  }

  const rows = data ?? [];
  return rows.map((row) => ({
    chunkId: row.chunk_id,
    documentId: row.document_id,
    chunkIndex: row.chunk_index,
    pageNumber: row.page_number,
    charStart: row.char_start,
    charEnd: row.char_end,
    sectionTitle: row.section_title,
    content: row.content,
    documentTitle: row.document_title,
    documentAuthors: row.document_authors,
    documentSourceUrl: row.document_source_url,
    documentYear: row.document_year,
    score: row.score,
  }));
}

export { toPgVector };
