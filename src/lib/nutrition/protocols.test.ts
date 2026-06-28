import { describe, expect, it } from "vitest";

import {
  PROTOCOL_TIMING_LABEL_TR,
  PROTOCOL_TIMING_ORDER,
  sortByTiming,
} from "./protocols";

describe("PROTOCOL_TIMING_ORDER", () => {
  it("runs morning → night along the day", () => {
    expect(PROTOCOL_TIMING_ORDER).toEqual([
      "morning",
      "pre_workout",
      "intra_workout",
      "post_workout",
      "night",
    ]);
  });

  it("has a Turkish label for every timing", () => {
    for (const t of PROTOCOL_TIMING_ORDER) {
      expect(PROTOCOL_TIMING_LABEL_TR[t]).toBeTruthy();
    }
  });
});

describe("sortByTiming", () => {
  it("orders by timing slot, then by order_index", () => {
    const input = [
      { timing: "post_workout", order_index: 0, id: "a" },
      { timing: "morning", order_index: 1, id: "b" },
      { timing: "morning", order_index: 0, id: "c" },
      { timing: "pre_workout", order_index: 0, id: "d" },
    ];
    expect(sortByTiming(input).map((x) => x.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { timing: "night", order_index: 0, id: "a" },
      { timing: "morning", order_index: 0, id: "b" },
    ];
    sortByTiming(input);
    expect(input.map((x) => x.id)).toEqual(["a", "b"]);
  });
});
