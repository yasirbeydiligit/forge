import { describe, expect, it } from "vitest";

import {
  exerciseCategories,
  exerciseRegions,
  filterExercises,
  groupExercisesByCategory,
  UNCATEGORIZED,
  type FilterableExercise,
} from "./filter";

const ex = (
  name: string,
  category: string | null,
  region: string | null = null,
): FilterableExercise => ({ id: name, name, category, region });

const list: FilterableExercise[] = [
  ex("Eğimli Press", "Göğüs", "Üst Göğüs"),
  ex("Bench Press", "Göğüs", null),
  ex("Cable Fly", "Göğüs", "İç Göğüs"),
  ex("Lat Pulldown", "Sırt", "Kanat"),
  ex("Custom Move", null, null),
];

describe("exerciseCategories", () => {
  it("returns present categories in canonical order, null bucket last", () => {
    expect(exerciseCategories(list)).toEqual(["Göğüs", "Sırt", UNCATEGORIZED]);
  });

  it("omits the null bucket when every exercise has a category", () => {
    expect(exerciseCategories(list.slice(0, 4))).toEqual(["Göğüs", "Sırt"]);
  });
});

describe("exerciseRegions", () => {
  it("returns distinct non-null regions across the list (Turkish order)", () => {
    expect(exerciseRegions(list)).toEqual(["İç Göğüs", "Kanat", "Üst Göğüs"]);
  });

  it("scopes regions to a category when given", () => {
    expect(exerciseRegions(list, "Göğüs")).toEqual(["İç Göğüs", "Üst Göğüs"]);
  });
});

describe("filterExercises", () => {
  it("returns all when no filter is set", () => {
    expect(filterExercises(list, {})).toHaveLength(5);
  });

  it("filters by category", () => {
    expect(filterExercises(list, { category: "Göğüs" }).map((e) => e.name)).toEqual(
      ["Eğimli Press", "Bench Press", "Cable Fly"],
    );
  });

  it("matches the uncategorized bucket", () => {
    expect(
      filterExercises(list, { category: UNCATEGORIZED }).map((e) => e.name),
    ).toEqual(["Custom Move"]);
  });

  it("filters by region", () => {
    expect(filterExercises(list, { region: "Üst Göğüs" }).map((e) => e.name)).toEqual(
      ["Eğimli Press"],
    );
  });

  it("filters by a case-insensitive name query", () => {
    expect(filterExercises(list, { query: "press" }).map((e) => e.name)).toEqual([
      "Eğimli Press",
      "Bench Press",
    ]);
  });

  it("combines category and region", () => {
    expect(
      filterExercises(list, { category: "Göğüs", region: "İç Göğüs" }).map(
        (e) => e.name,
      ),
    ).toEqual(["Cable Fly"]);
  });
});

describe("groupExercisesByCategory", () => {
  it("buckets by category in canonical order, preserving item order", () => {
    const groups = groupExercisesByCategory(list);
    expect(groups.map((g) => g.category)).toEqual(["Göğüs", "Sırt", UNCATEGORIZED]);
    expect(groups[0].items.map((e) => e.name)).toEqual([
      "Eğimli Press",
      "Bench Press",
      "Cable Fly",
    ]);
  });
});
