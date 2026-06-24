import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseTaxonomyCsv } from "./taxonomy-csv";

const HEADER =
  "slug,name,movement_pattern,equipment_type,primary_functions,secondary_functions,alternative_slugs,category,region,description,video_url";

describe("parseTaxonomyCsv", () => {
  it("parses a row, splitting ;-lists and nulling empty optionals", () => {
    const csv = [
      HEADER,
      "barbell-row,Barbell Row,pull_horizontal,barbell,lat-shoulder-extension,rhomboids-retraction;biceps-elbow-flexion,pendlay-row;dumbbell-row,Sırt,Orta Sırt,,",
    ].join("\n");

    const rows = parseTaxonomyCsv(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      slug: "barbell-row",
      name: "Barbell Row",
      movementPattern: "pull_horizontal",
      equipmentType: "barbell",
      primary: ["lat-shoulder-extension"],
      secondary: ["rhomboids-retraction", "biceps-elbow-flexion"],
      alternatives: ["pendlay-row", "dumbbell-row"],
      category: "Sırt",
      region: "Orta Sırt",
      description: null,
      videoUrl: null,
    });
  });

  it("ignores blank lines and trailing whitespace", () => {
    const csv = [
      HEADER,
      "",
      "  ",
      "plank,Plank,core,bodyweight,erectors-anti-flexion,,,Karın,,,",
      "",
    ].join("\n");

    expect(parseTaxonomyCsv(csv)).toHaveLength(1);
  });

  it("rejects a row with the wrong column count", () => {
    // 10 columns (pre-region format) is no longer accepted.
    const csv = [HEADER, "x,X,squat,barbell,quads-knee-extension,,,,,"].join("\n");

    expect(() => parseTaxonomyCsv(csv)).toThrow(/expected 11 columns/);
  });

  it("rejects an unknown movement_pattern", () => {
    const csv = [
      HEADER,
      "x,X,not_a_pattern,barbell,quads-knee-extension,,,,,,",
    ].join("\n");

    expect(() => parseTaxonomyCsv(csv)).toThrow(/movement_pattern.*not_a_pattern/);
  });

  it("rejects an unknown equipment_type", () => {
    const csv = [
      HEADER,
      "x,X,squat,spaceship,quads-knee-extension,,,,,,",
    ].join("\n");

    expect(() => parseTaxonomyCsv(csv)).toThrow(/equipment_type.*spaceship/);
  });

  it("rejects a row with no primary functions", () => {
    const csv = [HEADER, "x,X,squat,barbell,,,,,,,"].join("\n");

    expect(() => parseTaxonomyCsv(csv)).toThrow(/primary/i);
  });

  it("rejects a duplicate slug", () => {
    const csv = [
      HEADER,
      "dup,A,squat,barbell,quads-knee-extension,,,,,,",
      "dup,B,squat,barbell,quads-knee-extension,,,,,,",
    ].join("\n");

    expect(() => parseTaxonomyCsv(csv)).toThrow(/duplicate.*dup/i);
  });

  it("the shipped scripts/exercise-taxonomy.csv parses and self-references resolve", () => {
    const text = readFileSync(
      resolve(process.cwd(), "scripts/exercise-taxonomy.csv"),
      "utf8",
    );
    const rows = parseTaxonomyCsv(text);
    expect(rows.length).toBeGreaterThanOrEqual(40);

    const slugs = new Set(rows.map((r) => r.slug));
    for (const r of rows) {
      for (const alt of r.alternatives) {
        expect(slugs, `${r.slug} -> ${alt}`).toContain(alt);
      }
    }
  });
});
