import { describe, it, expect } from "vitest";

import { mapCitations, type CitationObject } from "./citations";
import type { RetrievedChunk } from "./retrieve";

/** A retrieved chunk with sensible defaults; override per test. */
function chunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    chunkId: "chunk-1",
    documentId: "doc-1",
    chunkIndex: 0,
    pageNumber: 12,
    charStart: 100,
    charEnd: 250,
    sectionTitle: "Hypertrophy",
    content: "Mechanical tension drives hypertrophy.",
    documentTitle: "Strength Training Anatomy",
    documentAuthors: "Frederic Delavier",
    documentSourceUrl: "https://example.com/doc-1",
    documentYear: 2010,
    score: 0.9,
    ...overrides,
  };
}

/** A returned `char_location` citation; override per test. */
function citation(overrides: Partial<CitationObject> = {}): CitationObject {
  return {
    type: "char_location",
    cited_text: "Mechanical tension drives hypertrophy.",
    document_index: 0,
    document_title: "Strength Training Anatomy",
    start_char_index: 0,
    end_char_index: 38,
    ...overrides,
  };
}

describe("mapCitations", () => {
  it("maps a citation to its source chunk via document_index, using cited_text as quotedText", () => {
    const chunks = [chunk()];
    const result = mapCitations([citation()], chunks);

    expect(result).toEqual([
      {
        documentId: "doc-1",
        chunkId: "chunk-1",
        pageNumber: 12,
        charStart: 100,
        charEnd: 250,
        quotedText: "Mechanical tension drives hypertrophy.",
        title: "Strength Training Anatomy",
      },
    ]);
  });

  it("maps multiple citations across different chunks (document_index picks the chunk)", () => {
    const chunks = [
      chunk({ chunkId: "c0", documentId: "d0", documentTitle: "Doc 0" }),
      chunk({ chunkId: "c1", documentId: "d1", documentTitle: "Doc 1", pageNumber: 5 }),
    ];
    const result = mapCitations(
      [
        citation({ document_index: 1, cited_text: "from doc one" }),
        citation({ document_index: 0, cited_text: "from doc zero" }),
      ],
      chunks,
    );

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      chunkId: "c1",
      documentId: "d1",
      pageNumber: 5,
      quotedText: "from doc one",
      title: "Doc 1",
    });
    expect(result[1]).toMatchObject({
      chunkId: "c0",
      documentId: "d0",
      quotedText: "from doc zero",
      title: "Doc 0",
    });
  });

  it("maps two citations pointing at the SAME chunk to two mapped citations", () => {
    const chunks = [chunk({ chunkId: "c0" })];
    const result = mapCitations(
      [
        citation({ cited_text: "first sentence", start_char_index: 0, end_char_index: 5 }),
        citation({ cited_text: "second sentence", start_char_index: 6, end_char_index: 12 }),
      ],
      chunks,
    );

    expect(result).toHaveLength(2);
    expect(result.map((c) => c.chunkId)).toEqual(["c0", "c0"]);
    expect(result.map((c) => c.quotedText)).toEqual([
      "first sentence",
      "second sentence",
    ]);
    // The chunk's char offsets (not the citation's) are copied through.
    expect(result[0].charStart).toBe(chunks[0].charStart);
    expect(result[0].charEnd).toBe(chunks[0].charEnd);
  });

  it("returns [] for an answer with no citations", () => {
    expect(mapCitations([], [chunk()])).toEqual([]);
  });

  it("skips a citation whose document_index is out of range (too high)", () => {
    const chunks = [chunk()];
    const result = mapCitations(
      [citation({ document_index: 5 }), citation({ document_index: 0 })],
      chunks,
    );
    expect(result).toHaveLength(1);
    expect(result[0].chunkId).toBe("chunk-1");
  });

  it("skips a citation with a negative document_index", () => {
    const result = mapCitations([citation({ document_index: -1 })], [chunk()]);
    expect(result).toEqual([]);
  });

  it("ignores non-char_location citation types (e.g. page_location)", () => {
    const chunks = [chunk()];
    const result = mapCitations(
      [
        { type: "page_location", document_index: 0, cited_text: "x" } as CitationObject,
        citation(),
      ],
      chunks,
    );
    expect(result).toHaveLength(1);
    expect(result[0].quotedText).toBe("Mechanical tension drives hypertrophy.");
  });
});
