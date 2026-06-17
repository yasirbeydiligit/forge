/**
 * Document chunking for the Research Library RAG pipeline.
 *
 * Pure module, no I/O. Splits per-page document text into overlapping chunks
 * sized for embedding (~500–800 tokens) while preserving the source page and
 * the character offsets within that page so chunks can be deep-linked back to
 * the original PDF. Tokens are approximated as ceil(chars / 4) — close enough
 * for sizing without pulling in a real tokenizer.
 */

export type Page = { pageNumber: number; text: string };

export type Chunk = {
  chunkIndex: number;
  pageNumber: number;
  /** Offset into the source page's text where this chunk begins (inclusive). */
  charStart: number;
  /** Offset into the source page's text where this chunk ends (exclusive). */
  charEnd: number;
  content: string;
};

/** Rough token estimate: ~4 characters per token, rounded up. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

// Sizing targets, expressed in characters (≈ tokens * 4).
const TARGET_TOKENS = 650; // middle of the 500–800 band
const TARGET_CHARS = TARGET_TOKENS * 4;
const MAX_TOKENS = 800;
const MAX_CHARS = MAX_TOKENS * 4;
const OVERLAP_TOKENS = 100;
const OVERLAP_CHARS = OVERLAP_TOKENS * 4;
// How far back from the hard cut we'll look for a clean sentence/paragraph
// boundary before giving up and cutting mid-text.
const BOUNDARY_SEARCH_CHARS = 320; // ~80 tokens

/**
 * Find a good break offset within `text` for a chunk starting at `start`.
 * Returns an exclusive end offset. Prefers a paragraph break, then a sentence
 * terminator, occurring at or before the max cut but not before the target —
 * falling back to the hard max cut when no boundary is nearby.
 */
function findBreak(text: string, start: number): number {
  const hardEnd = Math.min(text.length, start + MAX_CHARS);
  if (hardEnd >= text.length) return text.length;

  const target = start + TARGET_CHARS;
  // Window in which a boundary is "near the target size": from a bit before the
  // target up to the hard cap.
  const windowStart = Math.max(start + 1, target - BOUNDARY_SEARCH_CHARS);

  // 1) Prefer a paragraph boundary (blank line) inside the window.
  const paraEnd = lastBoundary(text, windowStart, hardEnd, /\n\s*\n/g);
  if (paraEnd !== -1) return paraEnd;

  // 2) Otherwise the last sentence terminator inside the window.
  const sentenceEnd = lastBoundary(text, windowStart, hardEnd, /[.!?]["')\]]?(?=\s|$)/g);
  if (sentenceEnd !== -1) return sentenceEnd;

  // 3) No clean boundary nearby — cut on the last whitespace before the cap,
  //    else hard-cut at the cap.
  const ws = text.lastIndexOf(" ", hardEnd - 1);
  if (ws > start) return ws + 1;
  return hardEnd;
}

/**
 * Returns the exclusive end offset of the last match of `re` whose end falls
 * within [from, to], or -1 if none. `re` must be a global regex.
 */
function lastBoundary(text: string, from: number, to: number, re: RegExp): number {
  re.lastIndex = from;
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    if (end > to) break;
    if (end >= from) last = end;
    if (re.lastIndex === m.index) re.lastIndex++; // guard against zero-width loops
  }
  return last;
}

function chunkPage(page: Page, startIndex: number): Chunk[] {
  const { text } = page;
  // A page that is only whitespace produces nothing.
  if (text.trim().length === 0) return [];

  const chunks: Chunk[] = [];
  let chunkIndex = startIndex;
  let start = 0;

  while (start < text.length) {
    // Skip leading whitespace so chunks don't begin on a newline.
    while (start < text.length && /\s/.test(text[start])) start++;
    if (start >= text.length) break;

    const end = findBreak(text, start);
    const content = text.slice(start, end);

    if (content.trim().length > 0) {
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        charStart: start,
        charEnd: end,
        content,
      });
    }

    if (end >= text.length) break;

    // Advance with overlap: step back ~OVERLAP_CHARS from the break, but always
    // make forward progress.
    const next = end - OVERLAP_CHARS;
    start = next > start ? next : end;
  }

  return chunks;
}

/**
 * Split a document's pages into overlapping, page-tagged chunks.
 * `chunkIndex` increases monotonically across the whole document.
 */
export function chunkPages(pages: Page[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const page of pages) {
    const pageChunks = chunkPage(page, chunks.length);
    chunks.push(...pageChunks);
  }
  return chunks;
}
