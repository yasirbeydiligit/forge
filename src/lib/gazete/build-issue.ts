/**
 * Forge Gazete issue builder — assembles the frozen jsonb payload from
 * extracted facts. Pure and deterministic: the same aggregates + seed produce
 * a bit-identical payload, so a printed issue is reproducible in tests while
 * the archive row stays the single source of truth.
 *
 * Honesty flows through from facts.ts: no positive fact → the neutral,
 * praise-free cover; no data at all → null (no issue is printed).
 */
import { formatNumber } from "@/lib/format";

import type { PeriodAggregates } from "./aggregate";
import {
  CLOSING_LINES,
  EDITOR_NOTES,
  fillTemplate,
  HEADLINES,
  NEUTRAL_HEADLINES,
  pickVariant,
  STORY_BODIES,
} from "./copy";
import { extractFacts, type Fact, type FactType } from "./facts";

export const MAX_STORIES = 5;
export const MAX_EDITOR_NOTES = 2;

export type IssuePayload = {
  v: 1;
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
  statTable: { label: string; value: string; delta: "up" | "down" | "flat" | null }[];
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
    cur.sessionsCompleted > 0 ||
    cur.weightSamples > 0 ||
    cur.sleepAvg != null ||
    cur.stepsAvg != null ||
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
      return { value: `${fact.slots.weight} kg`, label: String(fact.slots.exercise) };
    case "weight_trend":
      return { value: `${fact.slots.deltaKg} kg`, label: String(fact.slots.direction) };
    case "consistency":
      return { value: `${fact.slots.sessions}/${fact.slots.planned}`, label: "gün" };
    case "volume_trend":
      return { value: `+%${fact.slots.percent}`, label: "hacim" };
    case "protein_consistency":
      return { value: `${fact.slots.hit}/${fact.slots.logged}`, label: "gün" };
    case "sleep_improvement":
      return { value: `+${fact.slots.delta} sa`, label: "uyku" };
    case "steps_avg":
      return { value: formatNumber(Number(fact.slots.avg)), label: "adım/gün" };
    case "cardio_total":
      return { value: `${fact.slots.minutes} dk`, label: "kardiyo" };
    case "protocol_adherence":
      return { value: `${fact.slots.done}/${fact.slots.due}`, label: "protokol" };
    case "new_exercises":
      return { value: String(fact.slots.count), label: "yeni hareket" };
    case "best_session":
      return { value: `${fact.slots.tonnage} kg`, label: "zirve gün" };
  }
}

function buildStatTable(
  cur: PeriodAggregates,
  prev: PeriodAggregates | null,
): IssuePayload["statTable"] {
  const rows: IssuePayload["statTable"] = [];
  const delta = (c: number, p: number | null | undefined) => {
    if (p == null || p === 0) return null;
    if (c > p) return "up" as const;
    if (c < p) return "down" as const;
    return "flat" as const;
  };

  if (cur.sessionsCompleted > 0) {
    rows.push({
      label: "Antrenman",
      value: String(cur.sessionsCompleted),
      delta: delta(cur.sessionsCompleted, prev?.sessionsCompleted),
    });
  }
  if (cur.totalSets > 0) {
    rows.push({
      label: "Toplam set",
      value: String(cur.totalSets),
      delta: delta(cur.totalSets, prev?.totalSets),
    });
  }
  if (cur.tonnageKg > 0) {
    rows.push({
      label: "Tonaj",
      value: `${formatNumber(Math.round(cur.tonnageKg))} kg`,
      delta: delta(cur.tonnageKg, prev?.tonnageKg),
    });
  }
  if (cur.prCount > 0) {
    rows.push({ label: "Rekor", value: String(cur.prCount), delta: null });
  }
  if (cur.stepsAvg != null) {
    rows.push({
      label: "Adım ort.",
      value: formatNumber(cur.stepsAvg),
      delta: delta(cur.stepsAvg, prev?.stepsAvg),
    });
  }
  if (cur.sleepAvg != null) {
    rows.push({
      label: "Uyku ort.",
      value: `${Math.round(cur.sleepAvg * 10) / 10} sa`,
      delta: delta(cur.sleepAvg, prev?.sleepAvg),
    });
  }
  if (cur.cardioMinutes > 0) {
    rows.push({
      label: "Kardiyo",
      value: `${cur.cardioMinutes} dk`,
      delta: delta(cur.cardioMinutes, prev?.cardioMinutes),
    });
  }
  if (cur.nutritionDaysLogged > 0) {
    rows.push({
      label: "Beslenme kaydı",
      value: `${cur.nutritionDaysLogged} gün`,
      delta: null,
    });
  }
  if (cur.protocolDue > 0) {
    rows.push({
      label: "Protokol",
      value: `${cur.protocolDone}/${cur.protocolDue}`,
      delta: null,
    });
  }
  return rows;
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

  const top = positives[0];
  const headlineTitle = top
    ? fillTemplate(pickVariant(HEADLINES[top.type], `${ctx.seed}:h`), top.slots)
    : null;

  if (top && headlineTitle) {
    const body =
      fillTemplate(pickVariant(STORY_BODIES[top.type], `${ctx.seed}:l`), top.slots) ??
      headlineTitle;
    headline = { title: headlineTitle, factType: top.type };
    lead = {
      body,
      stat: leadStat(top),
      spark: cur.sparkTonnage.some((v) => v > 0) ? cur.sparkTonnage : null,
    };
    storyFacts = positives.slice(1, 1 + MAX_STORIES);
  } else {
    headline = {
      title: fillTemplate(pickVariant(NEUTRAL_HEADLINES, `${ctx.seed}:h`), {}) ?? "Dönem kayıtları masada",
      factType: "neutral",
    };
    lead = {
      body: "Bu dönemin kayıtları aşağıda — yorum yok, rakamlar sade.",
      stat: null,
      spark: cur.sparkTonnage.some((v) => v > 0) ? cur.sparkTonnage : null,
    };
    storyFacts = [];
  }

  // ---- Stories (skip any whose template can't be fully filled) ----
  const stories: IssuePayload["stories"] = [];
  for (const fact of storyFacts) {
    const title = fillTemplate(
      pickVariant(HEADLINES[fact.type], `${ctx.seed}:${fact.type}:t`),
      fact.slots,
    );
    const body = fillTemplate(
      pickVariant(STORY_BODIES[fact.type], `${ctx.seed}:${fact.type}:b`),
      fact.slots,
    );
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
    const note = fillTemplate(
      pickVariant(EDITOR_NOTES[caution.type], `${ctx.seed}:${caution.type}`),
      caution.slots,
    );
    if (note) editorNotes.push(note);
  }

  return {
    v: 1,
    headline,
    lead,
    stories,
    statTable: buildStatTable(cur, factsInput.previous),
    photos: ctx.photos,
    editorNotes,
    closing: {
      line: fillTemplate(pickVariant(CLOSING_LINES, `${ctx.seed}:c`), {}) ?? "Sonraki sayıda görüşmek üzere.",
      nextMilestoneMonths: ctx.nextMilestone?.months ?? null,
      nextMilestoneDate: ctx.nextMilestone?.dueDate ?? null,
    },
  };
}
