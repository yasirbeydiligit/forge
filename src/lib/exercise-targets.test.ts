import { describe, expect, it } from "vitest";

import { parseExerciseTargets } from "./exercise-targets";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("parseExerciseTargets", () => {
  it("returns [] for null, undefined and empty input", () => {
    expect(parseExerciseTargets(null)).toEqual([]);
    expect(parseExerciseTargets(undefined)).toEqual([]);
    expect(parseExerciseTargets("")).toEqual([]);
    expect(parseExerciseTargets("[]")).toEqual([]);
  });

  it("parses a valid array preserving order", () => {
    const raw = JSON.stringify([
      { muscleFunctionId: A, role: "primary" },
      { muscleFunctionId: B, role: "secondary" },
    ]);
    expect(parseExerciseTargets(raw)).toEqual([
      { muscleFunctionId: A, role: "primary" },
      { muscleFunctionId: B, role: "secondary" },
    ]);
  });

  it("dedups by muscleFunctionId, keeping the first occurrence", () => {
    const raw = JSON.stringify([
      { muscleFunctionId: A, role: "primary" },
      { muscleFunctionId: A, role: "secondary" },
    ]);
    expect(parseExerciseTargets(raw)).toEqual([
      { muscleFunctionId: A, role: "primary" },
    ]);
  });

  it("skips entries with an invalid role", () => {
    const raw = JSON.stringify([
      { muscleFunctionId: A, role: "tertiary" },
      { muscleFunctionId: B, role: "secondary" },
    ]);
    expect(parseExerciseTargets(raw)).toEqual([
      { muscleFunctionId: B, role: "secondary" },
    ]);
  });

  it("skips entries whose id is not a uuid", () => {
    const raw = JSON.stringify([
      { muscleFunctionId: "not-a-uuid", role: "primary" },
      { muscleFunctionId: B, role: "primary" },
    ]);
    expect(parseExerciseTargets(raw)).toEqual([
      { muscleFunctionId: B, role: "primary" },
    ]);
  });

  it("returns [] for malformed JSON or a non-array payload", () => {
    expect(parseExerciseTargets("{not json")).toEqual([]);
    expect(parseExerciseTargets(JSON.stringify({ muscleFunctionId: A }))).toEqual(
      [],
    );
  });

  it("accepts an already-parsed array (not just a JSON string)", () => {
    expect(
      parseExerciseTargets([{ muscleFunctionId: A, role: "primary" }]),
    ).toEqual([{ muscleFunctionId: A, role: "primary" }]);
  });
});
