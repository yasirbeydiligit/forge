import { Check, UtensilsCrossed } from "lucide-react";

import { formatDate } from "@/lib/format";
import { PROTOCOL_TIMING_LABEL_TR } from "@/lib/nutrition/protocols";
import type {
  NutritionDay,
  NutritionWeeklyReport,
} from "@/lib/reports/nutrition-weekly";
import { cn } from "@/lib/utils";

/**
 * Coach weekly nutrition + protocol-compliance view of one athlete. Day by day:
 * the meals (with times), daily macro totals against target (colour-coded hit),
 * and which protocols were completed. Calm editorial table; mono numbers.
 * Week navigation lives in the page-level WeekSwitcher.
 */
export function NutritionWeeklyReportView({
  report,
}: {
  report: NutritionWeeklyReport;
}) {
  const hasAnything =
    report.daysLogged > 0 || report.days.some((d) => d.protocolsTotal > 0);

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <UtensilsCrossed className="size-4" /> Haftalık beslenme
      </h2>

      {!hasAnything ? (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Bu hafta beslenme kaydı yok.
        </p>
      ) : (
        <>
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {report.daysLogged} gün kayıt · ort. {report.avgKcal.toLocaleString("tr-TR")} kcal/gün
          </p>
          <div className="space-y-2">
            {report.days.map((day) => (
              <DayCard key={day.date} day={day} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function DayCard({ day }: { day: NutritionDay }) {
  const logged = day.meals.length > 0;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border",
        !logged && day.protocolsTotal === 0 && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-3 py-2">
        <h3 className="font-serif text-sm font-semibold text-foreground">
          {formatDate(day.date, "EEEE")}
          <span className="ml-2 font-sans text-xs font-normal text-muted-foreground">
            {formatDate(day.date, "d MMM")}
          </span>
        </h3>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
          <MacroStat
            label="kcal"
            value={day.totals.kcal}
            target={day.target?.kcal ?? null}
            hit={day.hit.kcal}
            strong
          />
          <MacroStat label="P" value={day.totals.protein} target={day.target?.protein ?? null} hit={day.hit.protein} />
          <MacroStat label="K" value={day.totals.carbs} target={day.target?.carbs ?? null} hit={day.hit.carbs} />
          <MacroStat label="Y" value={day.totals.fat} target={day.target?.fat ?? null} hit={day.hit.fat} />
        </div>
      </div>

      <div className="space-y-2 px-3 py-2">
        {logged ? (
          <ul className="space-y-1">
            {day.meals.map((m, i) => (
              <li key={i} className="flex items-baseline gap-2 text-sm">
                <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {m.time ?? "—"}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {m.name}
                </span>
                <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {m.kcal.toLocaleString("tr-TR")} kcal
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-muted-foreground">Öğün kaydı yok.</p>
        )}

        {day.protocolsTotal > 0 ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2">
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              Protokol {day.protocolsDone}/{day.protocolsTotal}
            </span>
            {day.protocols.map((p) => (
              <span
                key={p.protocolId}
                title={`${PROTOCOL_TIMING_LABEL_TR[p.timing as keyof typeof PROTOCOL_TIMING_LABEL_TR] ?? p.timing}: ${p.name}${p.done && p.at ? ` · ${fmtTime(p.at)}` : ""}`}
                className={cn(
                  "inline-flex items-center gap-1 text-[11px]",
                  p.done ? "text-lab-green" : "text-muted-foreground/70",
                )}
              >
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-full border",
                    p.done
                      ? "border-lab-green bg-lab-green/15"
                      : "border-border",
                  )}
                  aria-hidden
                >
                  {p.done ? <Check className="size-2.5" /> : null}
                </span>
                {p.name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MacroStat({
  label,
  value,
  target,
  hit,
  strong = false,
}: {
  label: string;
  value: number;
  target: number | null;
  hit: boolean | null;
  strong?: boolean;
}) {
  const color =
    hit == null
      ? "text-muted-foreground"
      : hit
        ? "text-lab-green"
        : "text-lab-amber";
  return (
    <span
      className={cn(
        "font-mono text-xs tabular-nums",
        color,
        strong && "font-semibold",
      )}
    >
      {label} {value.toLocaleString("tr-TR")}
      {target != null ? (
        <span className="text-muted-foreground">
          /{target.toLocaleString("tr-TR")}
        </span>
      ) : null}
    </span>
  );
}
