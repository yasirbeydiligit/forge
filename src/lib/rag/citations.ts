/**
 * Map Anthropic Citations API objects back onto the library chunks we sent.
 *
 * Confirmed against the Citations doc
 * (https://platform.claude.com/docs/en/build-with-claude/citations.md) and the
 * `@anthropic-ai/sdk` types:
 *   - We send ONE plain-text `document` content block per retrieved chunk, in
 *     order, each with `citations: { enabled: true }` (see the chat action's
 *     `buildAnswerRequest`).
 *   - For plain-text documents the model returns `char_location` citations on
 *     its response text blocks, with `document_index` (0-indexed into the list
 *     of document blocks), `cited_text`, `start_char_index`/`end_char_index`
 *     (into the document data, NOT our DB char offsets), and `document_title`.
 *
 * Because document_index maps 1:1 to a sent chunk, `retrievedChunks[document_index]`
 * is the source chunk. We copy that chunk's DB coordinates
 * (documentId/chunkId/pageNumber/charStart/charEnd/title) and use the
 * citation's `cited_text` as the quoted text — the citation's own char indices
 * are relative to the document block, so we deliberately ignore them in favour
 * of the chunk's authoritative offsets.
 *
 * Pure module — no I/O, no env. Trivially unit-testable.
 */

import type { RetrievedChunk } from "./retrieve";

/**
 * A citation object as returned on a response text block. We only consume
 * `char_location` citations (plain-text documents); the shape is kept loose so
 * callers can pass the SDK union without narrowing first.
 */
export type CitationObject = {
  type: string;
  cited_text?: string;
  document_index?: number;
  document_title?: string | null;
  start_char_index?: number;
  end_char_index?: number;
};

export type MappedCitation = {
  documentId: string;
  chunkId: string;
  pageNumber: number | null;
  charStart: number;
  charEnd: number;
  quotedText: string;
  title: string;
};

/**
 * Map each returned citation onto its source chunk via `document_index`.
 * Citations that aren't `char_location` or whose `document_index` is out of
 * range are skipped safely. Returns `[]` when there are no citations.
 */
export function mapCitations(
  citationObjects: CitationObject[],
  retrievedChunks: RetrievedChunk[],
): MappedCitation[] {
  const mapped: MappedCitation[] = [];

  for (const citation of citationObjects) {
    if (citation.type !== "char_location") continue;

    const index = citation.document_index;
    if (
      index == null ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= retrievedChunks.length
    ) {
      continue;
    }

    const chunk = retrievedChunks[index];
    mapped.push({
      documentId: chunk.documentId,
      chunkId: chunk.chunkId,
      pageNumber: chunk.pageNumber,
      charStart: chunk.charStart,
      charEnd: chunk.charEnd,
      quotedText: citation.cited_text ?? "",
      title: chunk.documentTitle,
    });
  }

  return mapped;
}
