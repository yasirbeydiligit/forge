/**
 * Forge Gazete issue builder — assembles the frozen jsonb payload from
 * extracted facts plus three newspaper data sections (ANTRENMAN / BESLENME /
 * TAKİP). Pure and deterministic: the same aggregates + seed produce a
 * bit-identical payload, so a printed issue is reproducible in tests while
 * the archive row stays the single source of truth.
 *
 * Honesty flows through from facts.ts: no positive fact → the neutral,
 * praise-free cover; no data at all → null (no issue is printed). The data
 * sections state numbers without judgement — praise lives in the stories,
 * gentle reminders in the editor notes.
 */
import { round1 } from "@/lib/format";
import {
  getMetric,
  weightPolarityForGoal,
  type MetricKey,
  type Polarity,
} from "@/lib/metrics";

import type { NumericMetricKey, PeriodAggregates } from "./aggregate";
import {
  CLOSING_LINES,
  EDITOR_NOTES,
  HEADLINES,
  NEUTRAL_HEADLINES,
  renderTemplate,
  STORY_BODIES,
  trNum,
} from "./copy";
import { extractFacts, type Fact, type FactType } from "./facts";

export const MAX_STORIES = 5;
export const MAX_EDITOR_NOTES = 2;
/** Keep the muscle table readable — the long tail folds into "Diğer". */
export const MAX_MUSCLE_ROWS = 8;

export type SectionTrend = "up" | "down" | "flat";

export type IssuePayload = {
  v: 2;
  headline: { title: string; factType: FactType | "neutral" };
  lead: {
    body: string;
    stat: { value: number; suffix: string; label: string } | null;
    spark: number[] | null;
  };
  stories: {
    factType: FactType;
    title: string;
    body: string;
    stat: { value: string; label: string } | null;
    fill: number | null;
  }[];
  sections: {
    antrenman: {
      sessions: number;
      totalSets: number;
      setsPerSession: number | null;
      avgRir: number | null;
      prTotal: number;
      bestPr: { exercise: string; weight: number; reps: number } | null;
      prRegions: { region: string; count: number }[];
      /** Cover muscle: the most-trained muscle of the period. */
      topMuscle: { muscle: string; sets: number } | null;
      muscleSets: { muscle: string; sets: number }[];
      regionSets: { region: string; sets: number }[];
    } | null;
    beslenme: {
      daysLogged: number;
      kcal: {
        avg: number;
        target: number | null;
        inBand: number;
        over: number;
        under: number;
      } | null;
      macros: {
        proteinAvg: number | null;
        carbsAvg: number | null;
        fatAvg: number | null;
        proteinTarget: number | null;
      } | null;
      protocol: { done: number; due: number } | null;
    } | null;
    takip: {
      metrics: {
        key: NumericMetricKey;
        label: string;
        unit: string | null;
        /** Pre-formatted Turkish number. */
        avg: string;
        trend: SectionTrend | null;
        /** true = moved the desirable way; null = no judgement (trend polarity). */
        better: boolean | null;
      }[];
      water: {
        avgMl: number;
        goalMl: number | null;
        goalDays: number;
        daysLogged: number;
      } | null;
      cardio: { count: number; minutes: number; distanceKm: number } | null;
    } | null;
  };
  photos: {
    beforeId: string;
    afterId: string;
    beforeDate: string;
    afterDate: string;
    beforeWeightKg: number | null;
    afterWeightKg: number | null;
  } | null;
  editorNotes: string[];
  closing: {
    line: string;
    nextMilestoneMonths: number | null;
    nextMilestoneDate: string | null;
  };
};

export type BuildIssueContext = {
  /** `${athleteId}:${periodType}:${periodEnd}` — variant picking. */
  seed: string;
  periodType: "weekly" | "monthly" | "milestone";
  photos: IssuePayload["photos"];
  nextMilestone: { months: number; dueDate: string } | null;
};

function hasAnyData(cur: PeriodAggregates): boolean {
  return (
    cur.totalSets > 0 ||
    cur.sessionsTrained > 0 ||
    cur.weightSamples > 0 ||
    Object.keys(cur.metricAvgs).length > 0 ||
    cur.nutritionDaysLogged > 0 ||
    cur.cardioCount > 0 ||
    cur.protocolDue > 0
  );
}

/** The one number the lead counts up to, per headline fact type. */
function leadStat(fact: Fact): IssuePayload["lead"]["stat"] {
  switch (fact.type) {
    case "pr_count":
      return { value: Number(fact.slots.count), suffix: "", label: "yeni rekor" };
    case "weight_trend":
      return { value: Number(fact.slots.deltaKg), suffix: " kg", label: String(fact.slots.direction) };
    case "consistency":
      return { value: Number(fact.slots.sessions), suffix: "", label: "antrenman" };
    case "volume_trend":
      return { value: Number(fact.slots.percent), suffix: "%", label: "hacim artışı" };
    case "protein_consistency":
      return { value: Number(fact.slots.hit), suffix: "", label: "gün protein tamam" };
    case "sleep_improvement":
      return { value: Number(fact.slots.avg), suffix: " sa", label: "ortalama uyku" };
    case "steps_avg":
      return { value: Number(fact.slots.avg), suffix: "", label: "adım/gün" };
    case "cardio_total":
      return { value: Number(fact.slots.minutes), suffix: " dk", label: "kardiyo" };
    case "protocol_adherence":
      return { value: Number(fact.slots.done), suffix: "", label: "protokol işlendi" };
    case "new_exercises":
      return { value: Number(fact.slots.count), suffix: "", label: "yeni hareket" };
    case "best_session":
      return { value: Number(fact.slots.sets), suffix: "", label: "setlik zirve gün" };
  }
}

/** Small per-story emphasis stat shown on the card. */
function storyStat(fact: Fact): { value: string; label: string } | null {
  switch (fact.type) {
    case "pr_count":
      return { value: `${trNum(Number(fact.slots.weight))} kg`, label: String(fact.slots.exercise) };
    case "weight_trend":
      return { value: `${trNum(Number(fact.slots.deltaKg))} kg`, label: String(fact.slots.direction) };
    case "consistency":
      return { value: `${fact.slots.sessions}/${fact.slots.planned}`, label: "antrenman" };
    case "volume_trend":
      return { value: `+%${fact.slots.percent}`, label: "hacim" };
    case "protein_consistency":
      return { value: `${fact.slots.hit}/${fact.slots.logged}`, label: "gün" };
    case "sleep_improvement":
      return { value: `+${trNum(Number(fact.slots.delta))} sa`, label: "uyku" };
    case "steps_avg":
      return { value: trNum(Number(fact.slots.avg)), label: "adım/gün" };
    case "cardio_total":
      return { value: `${fact.slots.minutes} dk`, label: "kardiyo" };
    case "protocol_adherence":
      return { value: `${fact.slots.done}/${fact.slots.due}`, label: "protokol" };
    case "new_exercises":
      return { value: String(fact.slots.count), label: "yeni hareket" };
    case "best_session":
      return { value: `${fact.slots.sets} set`, label: "zirve gün" };
  }
}

/** Fold the long tail of the muscle table into a single "Diğer" row. */
function foldMuscleRows(
  rows: { muscle: string; sets: number }[],
): { muscle: string; sets: number }[] {
  if (rows.length <= MAX_MUSCLE_ROWS) return rows;
  const head = rows.slice(0, MAX_MUSCLE_ROWS - 1);
  const rest = rows.slice(MAX_MUSCLE_ROWS - 1);
  return [
    ...head,
    { muscle: "Diğer", sets: rest.reduce((a, r) => a + r.sets, 0) },
  ];
}

function buildAntrenman(cur: PeriodAggregates) {
  if (cur.totalSets === 0 && cur.sessionsTrained === 0) return null;
  return {
    sessions: cur.sessionsTrained,
    totalSets: cur.totalSets,
    setsPerSession: cur.setsPerSession,
    avgRir: cur.avgRir,
    prTotal: cur.prCount,
    bestPr: cur.bestPr,
    prRegions: cur.prRegions,
    topMuscle: cur.muscleSets[0] ?? null,
    muscleSets: foldMuscleRows(cur.muscleSets),
    regionSets: cur.regionSets,
  };
}

function buildBeslenme(cur: PeriodAggregates) {
  const hasNutrition = cur.nutritionDaysLogged > 0;
  const hasProtocol = cur.protocolDue > 0;
  if (!hasNutrition && !hasProtocol) return null;
  return {
    daysLogged: cur.nutritionDaysLogged,
    kcal:
      hasNutrition && cur.kcalAvg != null
        ? {
            avg: cur.kcalAvg,
            target: cur.targetKcal,
            inBand: cur.kcalDaysInBand,
            over: cur.kcalDaysOver,
            under: cur.kcalDaysUnder,
          }
        : null,
    macros: hasNutrition
      ? {
          proteinAvg: cur.proteinAvg,
          carbsAvg: cur.carbsAvg,
          fatAvg: cur.fatAvg,
          proteinTarget: cur.targetProtein,
        }
      : null,
    protocol: hasProtocol ? { done: cur.protocolDone, due: cur.protocolDue } : null,
  };
}

/** Metric row order in the takip table (registry order, weight first). */
const TAKIP_KEYS: NumericMetricKey[] = [
  "weight",
  "sleep_hours",
  "resting_hr",
  "energy",
  "hunger",
  "adherence",
  "digestion",
  "steps",
];

/** Minimum meaningful average delta per metric unit (noise floor). */
function trendOf(curAvg: number, prevAvg: number | undefined, epsilon: number): SectionTrend | null {
  if (prevAvg == null) return null;
  const d = curAvg - prevAvg;
  if (Math.abs(d) < epsilon) return "flat";
  return d > 0 ? "up" : "down";
}

const TREND_EPSILON: Record<NumericMetricKey, number> = {
  weight: 0.2,
  sleep_hours: 0.2,
  resting_hr: 1,
  energy: 0.4,
  hunger: 0.4,
  adherence: 0.4,
  digestion: 0.4,
  steps: 500,
};

function buildTakip(
  cur: PeriodAggregates,
  prev: PeriodAggregates | null,
  goal: Parameters<typeof weightPolarityForGoal>[0],
) {
  const metrics: NonNullable<IssuePayload["sections"]["takip"]>["metrics"] = [];
  for (const key of TAKIP_KEYS) {
    const avg = cur.metricAvgs[key];
    if (avg == null) continue;
    const def = getMetric(key as MetricKey);
    const polarity: Polarity =
      key === "weight" ? weightPolarityForGoal(goal) : def.polarity;
    const trend = trendOf(avg, prev?.metricAvgs[key], TREND_EPSILON[key]);
    let better: boolean | null = null;
    if (trend && trend !== "flat" && (polarity === "higherBetter" || polarity === "lowerBetter")) {
      better = polarity === "higherBetter" ? trend === "up" : trend === "down";
    }
    metrics.push({
      key,
      label: def.label,
      unit: def.unit,
      avg: trNum(key === "steps" || key === "resting_hr" ? Math.round(avg) : round1(avg)),
      trend,
      better,
    });
  }

  const water =
    cur.waterAvgMl != null
      ? {
          avgMl: cur.waterAvgMl,
          goalMl: cur.targetWaterMl,
          goalDays: cur.waterGoalDays,
          daysLogged: cur.waterDaysLogged,
        }
      : null;
  const cardio =
    cur.cardioCount > 0
      ? {
          count: cur.cardioCount,
          minutes: cur.cardioMinutes,
          distanceKm: round1(cur.cardioDistanceKm),
        }
      : null;

  if (metrics.length === 0 && !water && !cardio) return null;
  return { metrics, water, cardio };
}

export function buildIssue(
  ctx: BuildIssueContext,
  factsInput: Parameters<typeof extractFacts>[0],
): IssuePayload | null {
  const cur = factsInput.current;
  if (!hasAnyData(cur)) return null;

  const { facts, cautions } = extractFacts(factsInput);
  const positives = facts.filter((f) => f.direction === "positive");

  // ---- Headline + lead ----
  let headline: IssuePayload["headline"];
  let lead: IssuePayload["lead"];
  let storyFacts: Fact[];

  const periodGenCap = { weekly: "Haftanın", monthly: "Ayın", milestone: "Dönemin" }[
    ctx.periodType
  ];
  const top = positives[0];
  const headlineTitle = top
    ? renderTemplate(HEADLINES[top.type], top.slots, `${ctx.seed}:h`)
    : null;

  if (top && headlineTitle) {
    const body =
      renderTemplate(STORY_BODIES[top.type], top.slots, `${ctx.seed}:l`) ?? headlineTitle;
    headline = { title: headlineTitle, factType: top.type };
    lead = {
      body,
      stat: leadStat(top),
      spark: cur.sparkSets.some((v) => v > 0) ? cur.sparkSets : null,
    };
    storyFacts = positives.slice(1, 1 + MAX_STORIES);
  } else {
    headline = {
      title:
        renderTemplate(NEUTRAL_HEADLINES, { periodGenCap }, `${ctx.seed}:h`) ??
        "Dönem raporu hazır",
      factType: "neutral",
    };
    lead = {
      body: "Bu sayıda yorum yok; dönemin kayıtları aşağıda, oldukları gibi.",
      stat: null,
      spark: cur.sparkSets.some((v) => v > 0) ? cur.sparkSets : null,
    };
    storyFacts = [];
  }

  // ---- Stories (skip any whose template can't be fully filled) ----
  const stories: IssuePayload["stories"] = [];
  for (const fact of storyFacts) {
    const title = renderTemplate(HEADLINES[fact.type], fact.slots, `${ctx.seed}:${fact.type}:t`);
    const body = renderTemplate(STORY_BODIES[fact.type], fact.slots, `${ctx.seed}:${fact.type}:b`);
    if (!title || !body) continue;
    stories.push({
      factType: fact.type,
      title,
      body,
      stat: storyStat(fact),
      fill: fact.fill ?? null,
    });
  }

  // ---- Editor notes (max 2, already severity-sorted) ----
  const editorNotes: string[] = [];
  for (const caution of cautions.slice(0, MAX_EDITOR_NOTES)) {
    const note = renderTemplate(
      EDITOR_NOTES[caution.type],
      caution.slots,
      `${ctx.seed}:${caution.type}`,
    );
    if (note) editorNotes.push(note);
  }

  return {
    v: 2,
    headline,
    lead,
    stories,
    sections: {
      antrenman: buildAntrenman(cur),
      beslenme: buildBeslenme(cur),
      takip: buildTakip(cur, factsInput.previous, factsInput.goal),
    },
    photos: ctx.photos,
    editorNotes,
    closing: {
      line: renderTemplate(CLOSING_LINES, {}, `${ctx.seed}:c`) ?? "Sonraki sayıda görüşmek üzere.",
      nextMilestoneMonths: ctx.nextMilestone?.months ?? null,
      nextMilestoneDate: ctx.nextMilestone?.dueDate ?? null,
    },
  };
}
