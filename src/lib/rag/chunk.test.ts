import { describe, it, expect } from "vitest";

import { chunkPages, estimateTokens, type Page } from "./chunk";

describe("estimateTokens", () => {
  it("approximates tokens as ceil(chars / 4)", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("a")).toBe(1);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("a".repeat(2000))).toBe(500);
  });
});

/** Build a page of roughly `tokens` tokens (≈ tokens*4 chars) made of sentences. */
function pageOfTokens(pageNumber: number, tokens: number): Page {
  const sentence = "This is a filler sentence used for chunk sizing tests. ";
  const targetChars = tokens * 4;
  let text = "";
  while (text.length < targetChars) {
    text += sentence;
  }
  return { pageNumber, text };
}

describe("chunkPages", () => {
  it("returns no chunks for empty input", () => {
    expect(chunkPages([])).toEqual([]);
  });

  it("drops whitespace-only and empty pages", () => {
    const chunks = chunkPages([
      { pageNumber: 1, text: "" },
      { pageNumber: 2, text: "   \n\t  \n " },
    ]);
    expect(chunks).toEqual([]);
  });

  it("yields exactly one chunk for a short single page covering the whole page", () => {
    const text = "Short page. Only a few words here.";
    const chunks = chunkPages([{ pageNumber: 3, text }]);
    expect(chunks).toHaveLength(1);
    const c = chunks[0];
    expect(c.chunkIndex).toBe(0);
    expect(c.pageNumber).toBe(3);
    expect(c.charStart).toBe(0);
    expect(c.charEnd).toBe(text.length);
    expect(c.content).toBe(text);
  });

  it("splits a long page into multiple ~500-800 token chunks", () => {
    const page = pageOfTokens(1, 2400); // well over a single chunk
    const chunks = chunkPages([page]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      const toks = estimateTokens(c.content);
      // allow slack for boundary snapping + last (remainder) chunk being small
      expect(toks).toBeLessThanOrEqual(900);
    }
    // all but the final chunk should be at least roughly chunk-sized
    for (const c of chunks.slice(0, -1)) {
      expect(estimateTokens(c.content)).toBeGreaterThanOrEqual(400);
    }
  });

  it("assigns a monotonically increasing chunkIndex across the whole document", () => {
    const chunks = chunkPages([pageOfTokens(1, 2000), pageOfTokens(2, 2000)]);
    expect(chunks.length).toBeGreaterThan(2);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it("tracks pageNumber and per-page char offsets that recover the content", () => {
    const page = pageOfTokens(7, 2000);
    const chunks = chunkPages([page]);
    for (const c of chunks) {
      expect(c.pageNumber).toBe(7);
      expect(c.charStart).toBeGreaterThanOrEqual(0);
      expect(c.charEnd).toBeLessThanOrEqual(page.text.length);
      expect(c.charStart).toBeLessThan(c.charEnd);
      // offsets are relative to that page's text and recover the content
      expect(page.text.slice(c.charStart, c.charEnd)).toBe(c.content);
    }
  });

  it("overlaps consecutive chunks by roughly 100 tokens", () => {
    const page = pageOfTokens(1, 2400);
    const chunks = chunkPages([page]);
    expect(chunks.length).toBeGreaterThan(1);
    // consecutive chunks on the same page should overlap (next starts before prev ends)
    for (let i = 1; i < chunks.length; i++) {
      const prev = chunks[i - 1];
      const cur = chunks[i];
      expect(cur.charStart).toBeLessThan(prev.charEnd);
      const overlapChars = prev.charEnd - cur.charStart;
      const overlapTokens = overlapChars / 4;
      // ~100-token overlap; generous bounds because we snap to boundaries
      expect(overlapTokens).toBeGreaterThan(20);
      expect(overlapTokens).toBeLessThan(260);
    }
  });

  it("prefers to break on sentence boundaries when one is near the target size", () => {
    const page = pageOfTokens(1, 1600);
    const chunks = chunkPages([page]);
    // a sentence-aware break should not leave a dangling partial sentence:
    // every non-final chunk ends at a sentence terminator (after trim).
    for (const c of chunks.slice(0, -1)) {
      const trimmed = c.content.replace(/\s+$/, "");
      expect(/[.!?]$/.test(trimmed)).toBe(true);
    }
  });
});
