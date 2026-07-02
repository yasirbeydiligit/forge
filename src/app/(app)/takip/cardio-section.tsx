import { X } from "lucide-react";

import { deleteCardio } from "./actions";
import { CardioDialog } from "./cardio-dialog";
import { PaperCard, SectionLabel } from "@/components/lab/lab";
import { CARDIO_ICON, CARDIO_LABEL_TR } from "@/lib/cardio";
import { formatDate, formatNumber } from "@/lib/format";
import type { CardioSession } from "@/lib/types";

/** The shown week's free-form cardio entries, under the metric table. */
export function CardioSection({ entries }: { entries: CardioSession[] }) {
  return (
    <section className="mt-8 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Kardiyo</SectionLabel>
        <CardioDialog />
      </div>

      {entries.length === 0 ? (
        <PaperCard className="p-5">
          <p className="font-serif text-lg italic text-paper-muted">
            Bu hafta kardiyo kaydı yok.
          </p>
          <p className="mt-1 text-sm text-paper-muted">
            Yürüyüş, koşu, yüzme… kısa bir kayıt bile sayılır.
          </p>
        </PaperCard>
      ) : (
        <PaperCard className="divide-y divide-paper-border p-0">
          {entries.map((e) => {
            const Icon = CARDIO_ICON[e.activity];
            const stats = [
              `${e.duration_min} dk`,
              e.distance_km != null
                ? `${formatNumber(e.distance_km)} km`
                : null,
              e.calories != null ? `${e.calories} kcal` : null,
            ].filter(Boolean);
            return (
              <div key={e.id} className="flex items-center gap-3 p-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-paper-foreground/[0.06] text-lab-green">
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-paper-foreground">
                    {CARDIO_LABEL_TR[e.activity]}
                    <span className="ml-2 font-mono text-[11px] font-normal uppercase text-paper-muted">
                      {formatDate(e.session_date, "EEE d")}
                    </span>
                  </p>
                  {e.note ? (
                    <p className="truncate text-xs text-paper-muted">{e.note}</p>
                  ) : null}
                </div>
                <span className="shrink-0 font-mono text-[13px] tabular-nums text-paper-muted">
                  {stats.join(" · ")}
                </span>
                <form action={deleteCardio} className="shrink-0">
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    aria-label="Kaydı sil"
                    className="flex size-7 items-center justify-center rounded-md text-paper-muted transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </form>
              </div>
            );
          })}
        </PaperCard>
      )}
    </section>
  );
}
