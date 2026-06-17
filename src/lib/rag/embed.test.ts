import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { embedDocuments, embedQuery } from "./embed";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";

/** Build a fake Voyage 200 response for `n` inputs (embeddings are stubs). */
function okResponse(n: number, dim = 1024) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers(),
    json: async () => ({
      object: "list",
      model: "voyage-3.5",
      usage: { total_tokens: 42 },
      data: Array.from({ length: n }, (_, i) => ({
        object: "embedding",
        index: i,
        embedding: Array.from({ length: dim }, () => i / 1000),
      })),
    }),
    text: async () => "",
  } as unknown as Response;
}

function errorResponse(status: number, statusText = "Too Many Requests") {
  return {
    ok: false,
    status,
    statusText,
    headers: new Headers(),
    json: async () => ({}),
    text: async () => "rate limited",
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  // Make backoff sleeps instant.
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * Settle a promise while auto-advancing fake timers so backoff sleeps resolve.
 * The assertion is attached to `p` immediately (no unhandled rejection), then
 * timers are drained concurrently until `p` settles.
 */
function withTimers<T>(p: Promise<T>): Promise<T> {
  // Drain timers (and the microtasks they unblock) until the promise settles.
  void vi.runAllTimersAsync();
  return p;
}

describe("embedDocuments", () => {
  it("POSTs to the Voyage endpoint with bearer auth and the right body shape", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(2));

    const result = await withTimers(
      embedDocuments(["hello", "world"], "sk-test-key"),
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(VOYAGE_URL);
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk-test-key");
    expect(init.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("voyage-3.5");
    expect(body.input).toEqual(["hello", "world"]);
    expect(body.input_type).toBe("document");
    expect(body.output_dimension).toBe(1024);

    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(1024);
  });

  it("returns embeddings ordered by the response index, not arrival order", async () => {
    // Voyage returns out-of-order data; client must sort by index.
    const scrambled = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers(),
      json: async () => ({
        object: "list",
        model: "voyage-3.5",
        usage: { total_tokens: 3 },
        data: [
          { object: "embedding", index: 1, embedding: [1] },
          { object: "embedding", index: 0, embedding: [0] },
          { object: "embedding", index: 2, embedding: [2] },
        ],
      }),
      text: async () => "",
    } as unknown as Response;
    fetchMock.mockResolvedValueOnce(scrambled);

    const result = await withTimers(embedDocuments(["a", "b", "c"], "k"));
    expect(result).toEqual([[0], [1], [2]]);
  });

  it("batches an oversized texts array into multiple requests and concatenates in order", async () => {
    // 2500 small texts > 1000-per-request cap → 3 batches (1000, 1000, 500).
    const texts = Array.from({ length: 2500 }, (_, i) => `t${i}`);
    fetchMock
      .mockResolvedValueOnce(okResponse(1000))
      .mockResolvedValueOnce(okResponse(1000))
      .mockResolvedValueOnce(okResponse(500));

    const result = await withTimers(embedDocuments(texts, "k"));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const sizes = fetchMock.mock.calls.map(
      (c) => JSON.parse(c[1].body).input.length,
    );
    expect(sizes).toEqual([1000, 1000, 500]);
    expect(result).toHaveLength(2500);
  });

  it("batches by token budget when texts are large", async () => {
    // Each text ≈ 70K tokens (280K chars); two would exceed the 120K-token
    // budget, so each must go in its own request → 3 requests of 1.
    const big = "x".repeat(280_000);
    const texts = [big, big, big];
    fetchMock
      .mockResolvedValueOnce(okResponse(1))
      .mockResolvedValueOnce(okResponse(1))
      .mockResolvedValueOnce(okResponse(1));

    await withTimers(embedDocuments(texts, "k"));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    for (const call of fetchMock.mock.calls) {
      expect(JSON.parse(call[1].body).input).toHaveLength(1);
    }
  });

  it("retries on 429 then succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse(1));

    const result = await withTimers(embedDocuments(["x"], "k"));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
  });

  it("gives up after exhausting retries and throws", async () => {
    fetchMock.mockResolvedValue(errorResponse(429));

    await expect(
      withTimers(embedDocuments(["x"], "k")),
    ).rejects.toThrow(/Voyage embeddings request failed: 429/);
  });

  it("returns [] for empty input without calling fetch", async () => {
    const result = await embedDocuments([], "k");
    expect(result).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("embedQuery", () => {
  it("uses input_type 'query' and returns a single vector", async () => {
    fetchMock.mockResolvedValueOnce(okResponse(1));

    const result = await withTimers(embedQuery("how to squat", "k"));

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.input_type).toBe("query");
    expect(body.input).toEqual(["how to squat"]);
    expect(result).toHaveLength(1024);
  });
});
