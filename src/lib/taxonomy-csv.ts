/**
 * Pure parser for the editable exercise-taxonomy CSV
 * (scripts/exercise-taxonomy.csv). Kept side-effect free so it is unit-tested in
 * isolation; the DB import (scripts/import-exercise-taxonomy.ts) consumes its
 * output. Function-slug existence is checked against the DB at import time, not
 * here (this layer only validates structure + the closed enum vocabularies).
 */
import {
  EQUIPMENT_TYPES,
  MOVEMENT_PATTERNS,
  type EquipmentType,
  type MovementPattern,
} from "./taxonomy";

export type ParsedExercise = {
  slug: string;
  name: string;
  movementPattern: MovementPattern;
  equipmentType: EquipmentType;
  primary: string[];
  secondary: string[];
  alternatives: string[];
  category: string | null;
  region: string | null;
  description: string | null;
  videoUrl: string | null;
};

const COLUMNS = 11;

const patterns = new Set<string>(MOVEMENT_PATTERNS);
const equipment = new Set<string>(EQUIPMENT_TYPES);

/** Split a ;-separated cell into trimmed, non-empty tokens. */
function list(cell: string): string[] {
  return cell
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

function blank(cell: string): string | null {
  const v = cell.trim();
  return v.length > 0 ? v : null;
}

export function parseTaxonomyCsv(text: string): ParsedExercise[] {
  const lines = text.split(/\r?\n/);
  const out: ParsedExercise[] = [];
  const seen = new Set<string>();

  // First non-blank line is the header; skip it.
  let headerSeen = false;
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim().length === 0) continue;
    if (!headerSeen) {
      headerSeen = true;
      continue;
    }

    const cells = raw.split(",").map((c) => c.trim());
    if (cells.length !== COLUMNS) {
      throw new Error(
        `Row ${i + 1}: expected ${COLUMNS} columns, got ${cells.length}: "${raw}"`,
      );
    }
    const [
      slug,
      name,
      movementPattern,
      equipmentType,
      primaryRaw,
      secondaryRaw,
      altRaw,
      category,
      region,
      description,
      videoUrl,
    ] = cells;

    if (!slug) throw new Error(`Row ${i + 1}: missing slug`);
    if (seen.has(slug)) throw new Error(`Row ${i + 1}: duplicate slug "${slug}"`);
    if (!name) throw new Error(`Row ${i + 1} (${slug}): missing name`);
    if (!patterns.has(movementPattern)) {
      throw new Error(
        `Row ${i + 1} (${slug}): unknown movement_pattern "${movementPattern}"`,
      );
    }
    if (!equipment.has(equipmentType)) {
      throw new Error(
        `Row ${i + 1} (${slug}): unknown equipment_type "${equipmentType}"`,
      );
    }
    const primary = list(primaryRaw);
    if (primary.length === 0) {
      throw new Error(`Row ${i + 1} (${slug}): at least one primary function required`);
    }

    seen.add(slug);
    out.push({
      slug,
      name,
      movementPattern: movementPattern as MovementPattern,
      equipmentType: equipmentType as EquipmentType,
      primary,
      secondary: list(secondaryRaw),
      alternatives: list(altRaw),
      category: blank(category),
      region: blank(region),
      description: blank(description),
      videoUrl: blank(videoUrl),
    });
  }

  return out;
}
