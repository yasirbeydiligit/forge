/**
 * One derived triage alert + the grouped two-category list. The two alert
 * families stay visually apart because the coach's action differs:
 *
 *  - adherence  (data missing → "bring them back")  = DASHED amber frame
 *  - performance (data bad   → "review the plan")   = SOLID  violet frame
 *  - critical severity switches either frame to rose.
 *
 * No "use client": renders fine from server components; when pulled into the
 * client triage board the imported server actions become action references.
 */
import Link from "next/link";
import {
  Activity,
  CalendarX,
  ClipboardX,
  Eye,
  FlaskConical,
  Gauge,
  type LucideIcon,
  Scale,
  TrendingDown,
  UtensilsCrossed,
} from "lucide-react";

import { dismissAlert } from "@/app/(app)/panel/actions";
import type { AlertCategory, TriageAlert } from "@/lib/triage/types";
import { cn } from "@/lib/utils";

const ALERT_ICON: Record<string, LucideIcon> = {
  workout_gap: CalendarX,
  meal_gap: UtensilsCrossed,
  checkin_gap: ClipboardX,
  protocol_low: FlaskConical,
  protein_low: TrendingDown,
  plateau: Gauge,
  weight_trend: Scale,
  rir_extreme: Activity,
};

export const CATEGORY_LABEL_TR: Record<AlertCategory, string> = {
  adherence: "Uyum — kayıp sinyali",
  performance: "Performans — zorlanma sinyali",
};

function frameClasses(alert: TriageAlert) {
  if (alert.severity === "critical") {
    return alert.category === "adherence"
      ? "border-dashed border-lab-rose/60 bg-lab-rose/[0.05]"
      : "border-lab-rose/50 bg-lab-rose/[0.05]";
  }
  return alert.category === "adherence"
    ? "border-dashed border-lab-amber/60 bg-lab-amber/[0.05]"
    : "border-lab-violet/40 bg-lab-violet/[0.04]";
}

function iconClasses(alert: TriageAlert) {
  if (alert.severity === "critical") return "text-lab-rose";
  return alert.category === "adherence" ? "text-lab-amber" : "text-lab-violet";
}

export function AlertItem({
  alert,
  athleteId,
  detail = false,
}: {
  alert: TriageAlert;
  athleteId: string;
  /** true on the athlete page: show the long detail line, no cross-link. */
  detail?: boolean;
}) {
  const Icon = ALERT_ICON[alert.key] ?? Activity;
  const title = (
    <span className="text-sm font-medium text-paper-foreground">
      {alert.titleTr}
    </span>
  );

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border py-2 pl-3 pr-1.5",
        frameClasses(alert),
      )}
    >
      <Icon className={cn("size-4 shrink-0", iconClasses(alert))} />
      <div className="min-w-0 flex-1">
        {detail ? (
          title
        ) : (
          <Link
            href={`/panel/sporcular/${athleteId}?tab=${alert.tab}`}
            className="hover:underline"
          >
            {title}
          </Link>
        )}
        {detail ? (
          <p className="text-xs text-paper-muted">{alert.detailTr}</p>
        ) : null}
      </div>
      {alert.severity === "critical" ? (
        <span className="text-label shrink-0 text-lab-rose">kritik</span>
      ) : null}
      <form action={dismissAlert} className="shrink-0">
        <input type="hidden" name="athleteId" value={athleteId} />
        <input type="hidden" name="alertKey" value={alert.key} />
        <input type="hidden" name="fingerprint" value={alert.fingerprint} />
        <button
          type="submit"
          title="Görüldü olarak işaretle"
          aria-label={`${alert.titleTr} — görüldü olarak işaretle`}
          className="flex size-7 items-center justify-center rounded-md text-paper-muted transition-colors duration-[var(--dur-fast)] ease-soft hover:bg-paper-foreground/[0.06] hover:text-paper-foreground"
        >
          <Eye className="size-4" />
        </button>
      </form>
    </div>
  );
}

/** Alerts grouped adherence-first with their category caption lines. */
export function AlertGroups({
  alerts,
  athleteId,
  detail = false,
  limitPerCategory,
}: {
  alerts: TriageAlert[];
  athleteId: string;
  detail?: boolean;
  limitPerCategory?: number;
}) {
  const groups: AlertCategory[] = ["adherence", "performance"];
  return (
    <div className="space-y-2.5">
      {groups.map((category) => {
        const all = alerts.filter((a) => a.category === category);
        if (all.length === 0) return null;
        const shown = limitPerCategory ? all.slice(0, limitPerCategory) : all;
        const hidden = all.length - shown.length;
        return (
          <div key={category} className="space-y-1.5">
            <p
              className={cn(
                "text-label",
                category === "adherence" ? "text-lab-amber" : "text-lab-violet",
              )}
            >
              {CATEGORY_LABEL_TR[category]}
            </p>
            {shown.map((a) => (
              <AlertItem
                key={`${a.key}:${a.fingerprint}`}
                alert={a}
                athleteId={athleteId}
                detail={detail}
              />
            ))}
            {hidden > 0 ? (
              <p className="px-1 text-xs text-paper-muted">+{hidden} uyarı daha</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
