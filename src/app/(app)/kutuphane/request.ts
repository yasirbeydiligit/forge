/**
 * Pure request-building and response-parsing for the library chat action.
 *
 * These helpers are deliberately split out of `actions.ts` so they import
 * NEITHER `"use server"`, `ragEnv` (server-only, throws on import) NOR the
 * `@supabase/ssr` server client (`next/headers`). That keeps them trivially
 * unit-testable while the action file does the auth + DB + streaming wiring.
 *
 * Shapes confirmed against the Anthropic Citations doc
 * (https://platform.claude.com/docs/en/build-with-claude/citations.md) and the
 * `@anthropic-ai/sdk` types (DocumentBlockParam / PlainTextSource /
 * CitationsConfigParam / TextBlock / CitationCharLocation):
 *   - We send ONE plain-text `document` content block per retrieved chunk so
 *     each citation's `document_index` maps 1:1 to a chunk, followed by a single
 *     text block carrying the user question.
 *   - The model returns `char_location` citations on its response text blocks.
 */

import type Anthropic from "@anthropic-ai/sdk";

import type { CitationObject } from "@/lib/rag/citations";
import type { RetrievedChunk } from "@/lib/rag/retrieve";

/** Sonnet 4.6 — required by the plan; do NOT use structured outputs with citations. */
export const ANSWER_MODEL = "claude-sonnet-4-6";
export const ANSWER_MAX_TOKENS = 16000;

/** Exact refusal string the model must emit when the sources don't answer. */
export const NO_SOURCE_ANSWER = "Bu konuda kütüphanede bir kaynak bulamadım.";

/**
 * Turkish system prompt: answer ONLY from the provided sources, always cite,
 * and if the sources don't contain the answer, emit the exact refusal string.
 */
export const ANSWER_SYSTEM_PROMPT = [
  "Sen bir spor bilimi araştırma kütüphanesi asistanısın.",
  "SADECE sana verilen kaynak belgelerindeki bilgilere dayanarak yanıt ver.",
  "Kendi genel bilgini veya kaynaklarda olmayan hiçbir bilgiyi kullanma.",
  "Her iddiayı ilgili kaynağa dayandır (citations).",
  `Eğer verilen kaynaklar soruyu yanıtlamak için yeterli bilgi içermiyorsa, kesinlikle şu cümleyi aynen yaz: "${NO_SOURCE_ANSWER}"`,
  "Yanıtlarını Türkçe ver.",
].join(" ");

/**
 * Build the streaming Messages request. One plain-text `document` content block
 * per chunk (citations enabled) → document_index maps 1:1 to a chunk → then the
 * user's question as a text block. No `output_config.format` (incompatible with
 * citations).
 */
export function buildAnswerRequest(
  query: string,
  chunks: RetrievedChunk[],
): Anthropic.Messages.MessageStreamParams {
  const documentBlocks: Anthropic.Messages.DocumentBlockParam[] = chunks.map(
    (chunk) => ({
      type: "document",
      source: {
        type: "text",
        media_type: "text/plain",
        data: chunk.content,
      },
      title: chunk.documentTitle,
      citations: { enabled: true },
    }),
  );

  const content: Anthropic.Messages.ContentBlockParam[] = [
    ...documentBlocks,
    { type: "text", text: query },
  ];

  return {
    model: ANSWER_MODEL,
    max_tokens: ANSWER_MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: ANSWER_SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
  };
}

/**
 * Extract the answer text and the citation objects from a (final) message's
 * content blocks. Only `text` blocks contribute to the answer and carry
 * citations; thinking/other blocks are ignored.
 */
export function parseAnswer(
  content: Anthropic.Messages.ContentBlock[],
): { answer: string; citations: CitationObject[] } {
  let answer = "";
  const citations: CitationObject[] = [];

  for (const block of content) {
    if (block.type !== "text") continue;
    answer += block.text;
    if (block.citations) {
      for (const citation of block.citations) {
        citations.push(citation as CitationObject);
      }
    }
  }

  return { answer, citations };
}
