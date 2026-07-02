/**
 * Daily-tracker metric registry + the pure colouring core.
 *
 * The tracker's columns are data, not hard-coded markup: each metric is one
 * `MetricDef` here, and the page renders whichever ones the athlete has
 * enabled. Adding a metric later means adding a real column to `daily_metrics`
 * and one entry below — no EAV, no per-row migrations.
 *
 * Colouring is deliberately *relative*: a value is judged against the athlete's
 * own recent baseline (or their goal), so "6 h sleep" can read fine for one
 * person and poor for another. All of that logic lives in pure functions so it
 * can be unit-tested without a database or a browser.
 */

export type MetricKey =
  | "weight"
  | "sleep_hours"
  | "resting_hr"
  | "energy"
  | "hunger"
  | "adherence"
  | "digestion"
  | "steps"
  | "notes";

/**
 * How a value should be read:
 * - `higherBetter` / `lowerBetter` → coloured good/bad around the center.
 * - `trend` → never judged; show a neutral direction arrow only (e.g. weight,
 *   whose "good" way depends on the athlete's cut/bulk/maintain goal).
 * - `none` → not coloured at all (notes).
 */
export type Polarity = "higherBetter" | "lowerBetter" | "trend" | "none";

export type MetricDef = {
  key: MetricKey;
  /** Full Turkish label (settings dialog, average cards). */
  label: string;
  /** Short header label for the weekly table. */
  short: string;
  /** Mono unit shown next to values, or null. */
  unit: string | null;
  /** [min, max] valid range; values clamp to this. null for free text. */
  range: [number, number] | null;
  /** Decimal places kept on input; 0 = integer. */
  decimals: number;
  polarity: Polarity;
  /** Whether a per-athlete goal is meaningful (1–10 feelings: no). */
  goalAllowed: boolean;
  /**
   * Minimum spread (in the metric's own units) for the neutral band, so a
   * near-constant series doesn't flip to good/bad on tiny noise.
   */
  spreadFloor: number;
  /** Mobile keypad hint for the cell input. */
  inputMode: "decimal" | "numeric" | "text";
};

/** Canonical display order. The table and cards render in this order. */
export const METRICS: MetricDef[] = [
  {
    key: "weight",
    label: "Kilo",
    short: "Kilo",
    unit: "kg",
    range: [0, 300],
    decimals: 1,
    polarity: "trend",
    goalAllowed: true,
    spreadFloor: 0.3,
    inputMode: "decimal",
  },
  {
    key: "sleep_hours",
    label: "Uyku",
    short: "Uyku",
    unit: "s",
    range: [0, 24],
    decimals: 1,
    polarity: "higherBetter",
    goalAllowed: true,
    spreadFloor: 0.5,
    inputMode: "decimal",
  },
  {
    key: "resting_hr",
    label: "Dinlenik nabız",
    short: "RHR",
    unit: "bpm",
    range: [0, 250],
    decimals: 0,
    polarity: "lowerBetter",
    goalAllowed: true,
    spreadFloor: 2,
    inputMode: "numeric",
  },
  {
    key: "energy",
    label: "Enerji",
    short: "Enerji",
    unit: "/10",
    range: [0, 10],
    decimals: 0,
    polarity: "higherBetter",
    goalAllowed: false,
    spreadFloor: 0.7,
    inputMode: "numeric",
  },
  {
    key: "hunger",
    label: "Açlık",
    short: "Açlık",
    unit: "/10",
    range: [0, 10],
    decimals: 0,
    polarity: "lowerBetter",
    goalAllowed: false,
    spreadFloor: 0.7,
    inputMode: "numeric",
  },
  {
    key: "adherence",
    label: "Uyum",
    short: "Uyum",
    unit: "/10",
    range: [0, 10],
    decimals: 0,
    polarity: "higherBetter",
    goalAllowed: false,
    spreadFloor: 0.7,
    inputMode: "numeric",
  },
  {
    key: "digestion",
    label: "Sindirim",
    short: "Sindirim",
    unit: "/10",
    range: [0, 10],
    decimals: 0,
    polarity: "higherBetter",
    goalAllowed: false,
    spreadFloor: 0.7,
    inputMode: "numeric",
  },
  {
    key: "steps",
    label: "Adım",
    short: "Adım",
    unit: null,
    range: [0, 100000],
    decimals: 0,
    polarity: "higherBetter",
    goalAllowed: true,
    spreadFloor: 1000,
    inputMode: "numeric",
  },
  {
    key: "notes",
    label: "Not",
    short: "Not",
    unit: null,
    range: null,
    decimals: 0,
    polarity: "none",
    goalAllowed: false,
    spreadFloor: 0,
    inputMode: "text",
  },
];

const BY_KEY = new Map<MetricKey, MetricDef>(METRICS.map((m) => [m.key, m]));

export function getMetric(key: MetricKey): MetricDef {
  const def = BY_KEY.get(key);
  if (!def) throw new Error(`Unknown metric: ${key}`);
  return def;
}

function isMetricKey(value: unknown): value is MetricKey {
  return typeof value === "string" && BY_KEY.has(value as MetricKey);
}

/**
 * The columns shown when an athlete has never opened the settings dialog: the
 * pre-feature set (so nothing disappears for existing users) plus steps —
 * default-on as a headline daily-entry feature. Digestion stays opt-in.
 */
export const DEFAULT_ENABLED: MetricKey[] = [
  "weight",
  "sleep_hours",
  "resting_hr",
  "energy",
  "hunger",
  "adherence",
  "steps",
  "notes",
];

/**
 * Validate a stored `enabled` value into a clean list of metric keys, always
 * rendered in the registry's canonical order (we don't expose reordering).
 * Anything unusable falls back to {@link DEFAULT_ENABLED}.
 */
export function resolveEnabled(raw: unknown): MetricKey[] {
  if (!Array.isArray(raw)) return [...DEFAULT_ENABLED];
  const wanted = new Set(raw.filter(isMetricKey));
  if (wanted.size === 0) return [...DEFAULT_ENABLED];
  return METRICS.filter((m) => wanted.has(m.key)).map((m) => m.key);
}

export type Goals = Partial<Record<MetricKey, number>>;

/**
 * Validate a stored `goals` map: keep only finite, in-range goals for metrics
 * that actually allow one. Everything else is dropped.
 */
export function parseGoals(raw: unknown): Goals {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Goals = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isMetricKey(key)) continue;
    const def = getMetric(key);
    if (!def.goalAllowed) continue;
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) continue;
    if (def.range && (n < def.range[0] || n > def.range[1])) continue;
    out[key] = n;
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/*  Relative colouring (pure)                                                 */
/* -------------------------------------------------------------------------- */

/** Below this many recent samples we don't trust a personal baseline. */
export const MIN_BASELINE_SAMPLES = 4;

export type Baseline = {
  /** Mean of recent values, or null when there isn't enough history. */
  mean: number | null;
  /** max(stddev, spreadFloor) — the width of the neutral band. */
  spread: number;
  /** Number of finite samples used. */
  count: number;
};

/**
 * Reduce a metric's recent values into a baseline. Uses population standard
 * deviation, floored to `spreadFloor` so a steady series stays neutral.
 */
export function computeBaseline(
  values: readonly number[],
  spreadFloor: number,
): Baseline {
  const xs = values.filter((v): v is number => Number.isFinite(v));
  if (xs.length < MIN_BASELINE_SAMPLES) {
    return { mean: null, spread: spreadFloor, count: xs.length };
  }
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance =
    xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  return { mean, spread: Math.max(Math.sqrt(variance), spreadFloor), count: xs.length };
}

/** The point a value is judged against: an explicit goal wins, else the mean. */
export function metricCenter(
  baseline: Baseline,
  goal: number | null | undefined,
): number | null {
  return goal != null ? goal : baseline.mean;
}

export type Valence = "good" | "neutral" | "bad" | "none";

export type ValenceInput = {
  polarity: Polarity;
  /** Goal if set, else baseline mean; null → not enough info to judge. */
  center: number | null;
  spread: number;
  /** Neutral half-band as a fraction of spread (default 0.5). */
  band?: number;
};

/**
 * Judge one value relative to its center. Within ±band·spread is neutral;
 * beyond that it's good/bad according to the metric's polarity. `trend`/`none`
 * polarities and a missing center never produce a judgement.
 */
export function valence(value: number, input: ValenceInput): Valence {
  const { polarity, center, spread } = input;
  if (polarity === "trend" || polarity === "none") return "none";
  if (center == null || !Number.isFinite(value)) return "none";

  const band = (input.band ?? 0.5) * spread;
  const delta = value - center;
  if (Math.abs(delta) <= band) return "neutral";

  const above = delta > 0;
  const isGood = polarity === "higherBetter" ? above : !above;
  return isGood ? "good" : "bad";
}

/**
 * Training goals (from the athlete's profile preference) that give the weight
 * trend a direction: fat_loss → losing reads good, muscle_gain → gaining reads
 * good. Anything else keeps weight as an unjudged trend (arrow only).
 */
export type TrainingGoal =
  | "muscle_gain"
  | "strength"
  | "fat_loss"
  | "maintenance";

export function weightPolarityForGoal(
  goal: TrainingGoal | null | undefined,
): Polarity {
  if (goal === "fat_loss") return "lowerBetter";
  if (goal === "muscle_gain") return "higherBetter";
  return "trend";
}

export type Trend = "up" | "down" | "flat" | "none";

/** Raw direction of a value against a reference (used for trend-only metrics). */
export function trend(
  value: number,
  ref: number | null | undefined,
  epsilon = 0,
): Trend {
  if (ref == null || !Number.isFinite(value)) return "none";
  const delta = value - ref;
  if (Math.abs(delta) <= epsilon) return "flat";
  return delta > 0 ? "up" : "down";
}
