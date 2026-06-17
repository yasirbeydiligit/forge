/**
 * Per-page PDF text extraction for the Research Library RAG pipeline.
 *
 * Wraps `unpdf` (PDF.js under the hood) to extract text while preserving page
 * boundaries — one entry per page with a 1-based `pageNumber`. Downstream
 * chunking relies on these boundaries to tag chunks with their source page.
 *
 * Pure-ish: the only I/O is in-process PDF parsing (no network, no fs).
 */

import { extractText, getDocumentProxy } from "unpdf";

export type ParsedPage = { pageNumber: number; text: string };

/**
 * Extract text from a PDF, one entry per page (1-based `pageNumber`).
 *
 * unpdf's `extractText(data, { mergePages: false })` returns
 * `{ totalPages, text: string[] }` where `text[i]` is the text of page `i+1`.
 * We normalise each page's whitespace and map it to a 1-based page number.
 */
export async function parsePdf(
  data: Uint8Array | ArrayBuffer | Buffer,
): Promise<ParsedPage[]> {
  // PDF.js transfers/detaches the underlying buffer during parsing, so hand it
  // a fresh Uint8Array view over a copy of the bytes.
  const bytes = toUint8Array(data);
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });

  return text.map((pageText, i) => ({
    pageNumber: i + 1,
    text: normalize(pageText),
  }));
}

function toUint8Array(data: Uint8Array | ArrayBuffer | Buffer): Uint8Array {
  if (data instanceof Uint8Array) {
    // Copy so we never hand PDF.js a buffer that may be detached/reused.
    return new Uint8Array(data);
  }
  return new Uint8Array(data);
}

/** Collapse PDF.js's noisy whitespace into something chunk-friendly. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n") // normalise newlines
    .replace(/[ \t]+/g, " ") // collapse runs of spaces/tabs
    .replace(/\n{3,}/g, "\n\n") // cap blank-line runs at one
    .trim();
}
