import { describe, it, expect } from "vitest";

import type { RetrievedChunk } from "@/lib/rag/retrieve";

import {
  ANSWER_MAX_TOKENS,
  ANSWER_MODEL,
  NO_SOURCE_ANSWER,
  buildAnswerRequest,
  parseAnswer,
} from "./request";

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

describe("buildAnswerRequest", () => {
  const chunks = [
    chunk({ chunkId: "c0", content: "Source zero content.", documentTitle: "Doc Zero" }),
    chunk({ chunkId: "c1", content: "Source one content.", documentTitle: "Doc One" }),
  ];
  const req = buildAnswerRequest("Hipertrofi nasıl olur?", chunks);

  it("uses model claude-sonnet-4-6 and adaptive thinking", () => {
    expect(req.model).toBe(ANSWER_MODEL);
    expect(ANSWER_MODEL).toBe("claude-sonnet-4-6");
    expect(req.thinking).toEqual({ type: "adaptive" });
  });

  it("sets a generous max_tokens", () => {
    expect(req.max_tokens).toBe(ANSWER_MAX_TOKENS);
    expect(ANSWER_MAX_TOKENS).toBeGreaterThanOrEqual(16000);
  });

  it("emits one plain-text document block per chunk, in order, with citations enabled", () => {
    const content = req.messages[0].content;
    if (typeof content === "string") throw new Error("expected block content");

    const docs = content.filter((b) => b.type === "document");
    expect(docs).toHaveLength(2);

    docs.forEach((doc, i) => {
      if (doc.type !== "document") throw new Error("not a document block");
      expect(doc.citations).toEqual({ enabled: true });
      expect(doc.title).toBe(chunks[i].documentTitle);
      const source = doc.source;
      if (source.type !== "text") throw new Error("expected plain-text source");
      expect(source.media_type).toBe("text/plain");
      expect(source.data).toBe(chunks[i].content);
    });
  });

  it("appends the user question as the final text block", () => {
    const content = req.messages[0].content;
    if (typeof content === "string") throw new Error("expected block content");

    const last = content[content.length - 1];
    expect(last.type).toBe("text");
    if (last.type !== "text") throw new Error("expected text block");
    expect(last.text).toBe("Hipertrofi nasıl olur?");
  });

  it("does NOT set output_config / output_format (incompatible with citations)", () => {
    expect("output_config" in req).toBe(false);
    expect("output_format" in req).toBe(false);
  });

  it("includes the role:user message and a system prompt that mandates the exact refusal string", () => {
    expect(req.messages).toHaveLength(1);
    expect(req.messages[0].role).toBe("user");
    expect(String(req.system)).toContain(NO_SOURCE_ANSWER);
  });

  it("handles zero chunks (no document blocks, just the question)", () => {
    const empty = buildAnswerRequest("soru?", []);
    const content = empty.messages[0].content;
    if (typeof content === "string") throw new Error("expected block content");
    expect(content).toHaveLength(1);
    expect(content[0].type).toBe("text");
  });
});

describe("parseAnswer", () => {
  it("concatenates text blocks and collects their citations, ignoring non-text blocks", () => {
    const content = [
      { type: "thinking", thinking: "...", signature: "sig" },
      {
        type: "text",
        text: "Mekanik gerilim ",
        citations: [
          {
            type: "char_location",
            cited_text: "Mechanical tension",
            document_index: 0,
            document_title: "Doc Zero",
            start_char_index: 0,
            end_char_index: 18,
          },
        ],
      },
      {
        type: "text",
        text: "hipertrofiyi yönlendirir.",
        citations: [
          {
            type: "char_location",
            cited_text: "drives hypertrophy",
            document_index: 1,
            document_title: "Doc One",
            start_char_index: 19,
            end_char_index: 37,
          },
        ],
      },
    ] as unknown as Parameters<typeof parseAnswer>[0];

    const { answer, citations } = parseAnswer(content);
    expect(answer).toBe("Mekanik gerilim hipertrofiyi yönlendirir.");
    expect(citations).toHaveLength(2);
    expect(citations[0].document_index).toBe(0);
    expect(citations[1].document_index).toBe(1);
  });

  it("returns empty citations when text blocks carry none", () => {
    const content = [
      { type: "text", text: NO_SOURCE_ANSWER, citations: null },
    ] as unknown as Parameters<typeof parseAnswer>[0];

    const { answer, citations } = parseAnswer(content);
    expect(answer).toBe(NO_SOURCE_ANSWER);
    expect(citations).toEqual([]);
  });
});
