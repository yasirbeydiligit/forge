/**
 * Voyage AI embedding client for the Research Library RAG pipeline.
 *
 * SERVER-ONLY: this module talks to the Voyage API with a secret key. It must
 * only be imported from trusted server code. We intentionally do NOT add
 * `import "server-only"` (it throws in the vitest node env) and we do NOT read
 * `ragEnv` here — the API key is passed in as a parameter so units stay
 * testable. Production callers pass `ragEnv.voyageApiKey`.
 *
 * API reference (confirmed 2026-06-17):
 *   POST https://api.voyageai.com/v1/embeddings
 *   Header: Authorization: Bearer <apiKey>
 *   Body:  { model, input: string[], input_type, output_dimension }
 *   Resp:  { object, data: [{ object, embedding: number[], index }],
 *            model, usage: { total_tokens } }
 *   Limits (voyage-3.5): ≤1000 texts and ≤320K tokens per request; 429 on
 *   rate limit. See https://docs.voyageai.com/reference/embeddings-api
 */

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3.5";
const OUTPUT_DIMENSION = 1024;

// Per-request limits for voyage-3.5. We batch by count and by a conservative
// token estimate (chars/4) so we never blow the per-request token cap.
const MAX_TEXTS_PER_REQUEST = 1000;
const MAX_TOKENS_PER_REQUEST = 320_000;
// Keep a safety margin under the hard 320K cap.
const TOKEN_BUDGET_PER_REQUEST = 120_000;

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 500;

type InputType = "document" | "query";

type VoyageResponse = {
  object: string;
  data: { object: string; embedding: number[]; index: number }[];
  model: string;
  usage: { total_tokens: number };
};

function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

/** Split `texts` into batches respecting both the count and token limits. */
function batch(texts: string[]): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;

  for (const text of texts) {
    const tokens = estimateTokens(text);
    const wouldExceedCount = current.length >= MAX_TEXTS_PER_REQUEST;
    const wouldExceedTokens =
      current.length > 0 && currentTokens + tokens > TOKEN_BUDGET_PER_REQUEST;

    if (wouldExceedCount || wouldExceedTokens) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(text);
    currentTokens += tokens;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST one batch to Voyage, retrying on 429 (and 5xx) with exponential backoff. */
async function embedBatch(
  texts: string[],
  apiKey: string,
  inputType: InputType,
): Promise<number[][]> {
  const body = JSON.stringify({
    model: MODEL,
    input: texts,
    input_type: inputType,
    output_dimension: OUTPUT_DIMENSION,
  });

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (res.ok) {
      const json = (await res.json()) as VoyageResponse;
      // Voyage returns one entry per input; sort by index to guarantee order.
      return json.data
        .slice()
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);
    }

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : BASE_BACKOFF_MS * 2 ** attempt;
      await sleep(delay);
      continue;
    }

    const detail = await res.text().catch(() => "");
    throw new Error(
      `Voyage embeddings request failed: ${res.status} ${res.statusText}${
        detail ? ` — ${detail}` : ""
      }`,
    );
  }

  // Unreachable: the loop either returns or throws.
  throw new Error("Voyage embeddings request failed: exhausted retries");
}

async function embed(
  texts: string[],
  apiKey: string,
  inputType: InputType,
): Promise<number[][]> {
  if (texts.length === 0) return [];
  const results: number[][] = [];
  for (const b of batch(texts)) {
    const embeddings = await embedBatch(b, apiKey, inputType);
    results.push(...embeddings);
  }
  return results;
}

/**
 * Embed a list of documents (chunks). Returns one 1024-dim vector per input,
 * in the same order as `texts`. Batches large inputs to respect Voyage limits.
 */
export function embedDocuments(
  texts: string[],
  apiKey: string,
): Promise<number[][]> {
  return embed(texts, apiKey, "document");
}

/** Embed a single search query and return its 1024-dim vector. */
export async function embedQuery(
  text: string,
  apiKey: string,
): Promise<number[]> {
  const [embedding] = await embed([text], apiKey, "query");
  return embedding;
}

export { MAX_TOKENS_PER_REQUEST, OUTPUT_DIMENSION };
