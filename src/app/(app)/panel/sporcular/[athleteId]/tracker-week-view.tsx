/**
 * Read-only coach copy of the athlete's Günlük Takip week: the same coloured
 * table, valence marks, weekly-average cards and cardio list the athlete sees
 * — minus editing. Colouring comes from the shared buildCellConfigs, so coach
 * and athlete always read identical judgements.
 */
import { addDays, isSameDay } from "date-fns";

import {
  TrendMark,
  ValenceMark,
  VALENCE_CELL,
  VALENCE_TEXT,
} from "@/app/(app)/takip/valence-ui";
import { PaperCard, SectionLabel } from "@/components/lab/lab";
import { MeasureCard } from "@/components/measure-card";
import {
  CARDIO_LABEL_TR,
  cardioWeeklySummary,
  formatDuration,
} from "@/lib/cardio";
import { formatDate, formatNumber, toDateKey, WEEKDAY_LABELS } from "@/lib/format";
import {
  buildCellConfigs,
  getMetric,
  parseGoals,
  resolveEnabled,
  trend,
  valence,
  type MetricKey,
} from "@/lib/metrics";
import type { CardioSession, DailyMetric } from "@/lib/types";
import { cn } from "@/lib/utils";

const num = (v: unknown): number | null =>
  v != null && Number.isFinite(Number(v)) ? Number(v) : null;

function formatAvg(key: MetricKey, n: number): string {
  if (key === "steps") return Math.round(n).toLocaleString("tr-TR");
  return key === "resting_hr" ? String(Math.round(n)) : n.toFixed(1);
}

function formatCell(key: MetricKey, v: unknown): string {
  const n = num(v);
  if (n == null) return "—";
  if (key === "steps") return n.toLocaleString("tr-TR");
  return String(n);
}

export function CoachTrackerWeek({
  weekStart,
  rows,
  settingsEnabled,
  settingsGoals,
  profileGoal,
  cardio,
}: {
  weekStart: Date;
  /** daily_metrics rows covering the baseline window THROUGH the week end. */
  rows: DailyMetric[];
  settingsEnabled: unknown;
  settingsGoals: unknown;
  profileGoal: "muscle_gain" | "strength" | "fat_loss" | "maintenance" | null;
  /** Cardio sessions inside the shown week. */
  cardio: CardioSession[];
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const startKey = toDateKey(weekStart);
  const endKey = toDateKey(days[6]);

  const weekRows = rows.filter(
    (m) => m.metric_date >= startKey && m.metric_date <= endKey,
  );
  const historyRows = rows.filter((m) => m.metric_date < startKey);
  const byDate = new Map(weekRows.map((m) => [m.metric_date, m]));

  const enabled = resolveEnabled(settingsEnabled);
  const goals = parseGoals(settingsGoals);
  const numericCols = enabled.filter((k) => k !== "notes");
  const showNotes = enabled.includes("notes");

  const configs = buildCellConfigs({
    historyRows,
    columns: numericCols,
    goals,
    profileGoal,
  });

  const weekValues = (key: MetricKey) =>
    days
      .map((d) => num(byDate.get(toDateKey(d))?.[key]))
      .filter((v): v is number => v != null);

  const cardioSummary = cardioWeeklySummary(cardio);

  return (
    <div className="space-y-6">
      <PaperCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem]">
            <thead>
              <tr className="border-b border-paper-border text-[10px] font-semibold uppercase text-paper-muted">
                <th className="py-2 pl-3 text-left">Gün</th>
                {numericCols.map((key) => (
                  <th key={key} className="py-2 text-center">
                    {getMetric(key).short}
                  </th>
                ))}
                {showNotes ? <th className="py-2 pl-2 text-left">Not</th> : null}
              </tr>
            </thead>
            <tbody>
              {days.map((d, i) => {
                const key = toDateKey(d);
                const metric = byDate.get(key) ?? null;
                const isToday = isSameDay(d, new Date());
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-t border-border/60",
                      isToday && "bg-primary/[0.04]",
                    )}
                  >
                    <td className="py-1.5 pl-3">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isToday && "text-primary",
                        )}
                      >
                        {WEEKDAY_LABELS[i]}
                      </span>{" "}
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {d.getDate()}
                      </span>
                    </td>
                    {numericCols.map((colKey) => {
                      const cfg = configs[colKey];
                      const n = num(metric?.[colKey]);
                      let v: ReturnType<typeof valence> = "none";
                      let t: ReturnType<typeof trend> = "none";
                      if (cfg && n != null) {
                        if (cfg.polarity === "trend") t = trend(n, cfg.center);
                        else v = valence(n, cfg);
                      }
                      return (
                        <td
                          key={colKey}
                          className={cn("relative px-0.5", VALENCE_CELL[v])}
                        >
                          <span
                            className={cn(
                              "block py-2 text-center font-mono text-sm tabular-nums",
                              n == null ? "text-paper-muted" : VALENCE_TEXT[v],
                            )}
                          >
                            {formatCell(colKey, metric?.[colKey])}
                          </span>
                          <span className="pointer-events-none absolute right-0.5 top-1">
                            {cfg?.polarity === "trend" ? (
                              <TrendMark trend={t} />
                            ) : (
                              <ValenceMark valence={v} />
                            )}
                          </span>
                        </td>
                      );
                    })}
                    {showNotes ? (
                      <td className="max-w-[10rem] truncate py-2 pl-2 pr-3 text-left text-sm text-muted-foreground">
                        {metric?.notes ?? ""}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PaperCard>

      <section className="space-y-3">
        <SectionLabel>Bu hafta</SectionLabel>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {numericCols.map((key) => {
            const def = getMetric(key);
            const xs = weekValues(key);
            const avg = xs.length
              ? xs.reduce((a, b) => a + b, 0) / xs.length
              : null;
            const cfg = configs[key];

            const v = avg != null && cfg ? valence(avg, cfg) : "none";
            const accent = v === "bad" ? "rose" : "green";
            const emphasis = v === "good" || v === "bad";

            const goal = goals[key];
            const hint =
              def.polarity === "trend" && goal != null && avg != null
                ? `Hedefe ${Math.abs(avg - goal).toFixed(1)} ${def.unit ?? ""}`.trim()
                : undefined;

            return (
              <MeasureCard
                key={key}
                label={`Ort. ${def.label.toLowerCase()}`}
                value={avg != null ? formatAvg(key, avg) : "—"}
                unit={def.unit ?? undefined}
                points={xs}
                accent={accent}
                emphasis={emphasis}
                hint={hint}
              />
            );
          })}

          <MeasureCard
            label="Kardiyo"
            value={
              cardioSummary.totalMin > 0
                ? formatDuration(cardioSummary.totalMin)
                : "—"
            }
            accent="blue"
            hint={
              cardioSummary.count > 0
                ? `${cardioSummary.count} aktivite${
                    cardioSummary.topActivity
                      ? ` · en çok ${CARDIO_LABEL_TR[cardioSummary.topActivity].toLowerCase()}`
                      : ""
                  }`
                : undefined
            }
          />
        </div>
      </section>

      {cardio.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Kardiyo — bu hafta</SectionLabel>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Tarih</th>
                  <th className="px-2 py-2 text-left font-medium">Aktivite</th>
                  <th className="px-2 py-2 text-center font-medium">Süre</th>
                  <th className="px-2 py-2 text-center font-medium">Mesafe</th>
                  <th className="px-2 py-2 text-center font-medium">Kalori</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {cardio.map((c) => (
                  <tr key={c.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-left font-sans text-muted-foreground">
                      {formatDate(c.session_date, "d MMM")}
                    </td>
                    <td className="px-2 py-2 text-left font-sans">
                      {CARDIO_LABEL_TR[c.activity]}
                      {c.note ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          — {c.note}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {formatDuration(c.duration_min)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {c.distance_km != null
                        ? `${formatNumber(c.distance_km)} km`
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-center">{c.calories ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
