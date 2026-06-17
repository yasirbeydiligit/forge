import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock unpdf so we exercise parse's page-mapping/normalisation logic without a
// real PDF fixture. The real unpdf path is exercised for real during seeding.
const getDocumentProxy = vi.fn();
const extractText = vi.fn();

vi.mock("unpdf", () => ({
  getDocumentProxy: (...args: unknown[]) => getDocumentProxy(...args),
  extractText: (...args: unknown[]) => extractText(...args),
}));

import { parsePdf } from "./parse";

beforeEach(() => {
  vi.clearAllMocks();
  getDocumentProxy.mockResolvedValue({ __proxy: true });
});

describe("parsePdf", () => {
  it("maps unpdf's per-page text array to {pageNumber, text}[] with 1-based pages", async () => {
    extractText.mockResolvedValue({
      totalPages: 3,
      text: ["First page.", "Second page.", "Third page."],
    });

    const pages = await parsePdf(new Uint8Array([0x25, 0x50, 0x44, 0x46]));

    expect(pages).toEqual([
      { pageNumber: 1, text: "First page." },
      { pageNumber: 2, text: "Second page." },
      { pageNumber: 3, text: "Third page." },
    ]);
  });

  it("requests per-page text (mergePages: false)", async () => {
    extractText.mockResolvedValue({ totalPages: 1, text: ["x"] });

    await parsePdf(new Uint8Array([1, 2, 3]));

    expect(getDocumentProxy).toHaveBeenCalledOnce();
    expect(extractText).toHaveBeenCalledWith(
      { __proxy: true },
      { mergePages: false },
    );
  });

  it("normalises whitespace per page", async () => {
    extractText.mockResolvedValue({
      totalPages: 1,
      text: ["  Hello\r\n\r\n\r\n\r\nworld   with\t\ttabs  "],
    });

    const pages = await parsePdf(new Uint8Array([0]));

    expect(pages).toEqual([{ pageNumber: 1, text: "Hello\n\nworld with tabs" }]);
  });

  it("accepts ArrayBuffer and Buffer inputs", async () => {
    extractText.mockResolvedValue({ totalPages: 1, text: ["ok"] });

    await parsePdf(new ArrayBuffer(8));
    await parsePdf(Buffer.from([4, 5, 6]));

    expect(getDocumentProxy).toHaveBeenCalledTimes(2);
    // every call receives a Uint8Array view (copied, never the raw buffer)
    for (const call of getDocumentProxy.mock.calls) {
      expect(call[0]).toBeInstanceOf(Uint8Array);
    }
  });

  it("returns an empty array for a zero-page PDF", async () => {
    extractText.mockResolvedValue({ totalPages: 0, text: [] });

    const pages = await parsePdf(new Uint8Array([0]));

    expect(pages).toEqual([]);
  });
});
