"use client";

import { useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";

import { CompareView, type ComparablePhoto } from "./compare-view";
import { deletePhysiquePhoto } from "@/app/(app)/fizik/actions";
import { PaperCard, SectionLabel } from "@/components/lab/lab";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Month-grouped photo grid with a two-photo compare mode. Data-agnostic:
 * the athlete page passes canDelete, the coach view reuses it read-only.
 */
export function PhotoTimeline({
  photos,
  canDelete,
}: {
  /** Newest first (page orders by photo_date desc). */
  photos: ComparablePhoto[];
  canDelete: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const compareRef = useRef<HTMLDivElement>(null);

  const months = useMemo(() => {
    const groups = new Map<string, ComparablePhoto[]>();
    for (const p of photos) {
      const key = formatDate(p.photo_date, "MMMM yyyy");
      const list = groups.get(key);
      if (list) list.push(p);
      else groups.set(key, [p]);
    }
    return [...groups.entries()];
  }, [photos]);

  const pair = useMemo(
    () =>
      selected.length === 2
        ? (selected.map((id) => photos.find((p) => p.id === id)) as [
            ComparablePhoto | undefined,
            ComparablePhoto | undefined,
          ])
        : null,
    [selected, photos],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      const next = [...prev, id].slice(-2);
      if (next.length === 2) {
        // Bring the freshly formed comparison into view on mobile.
        requestAnimationFrame(() =>
          compareRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
        );
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div ref={compareRef} className="scroll-mt-20">
        {pair && pair[0] && pair[1] ? (
          <CompareView a={pair[0]} b={pair[1]} onClose={() => setSelected([])} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Karşılaştırmak için iki fotoğraf seç
            {selected.length === 1 ? " — bir tane daha." : "."}
          </p>
        )}
      </div>

      {months.map(([month, list]) => (
        <section key={month} className="space-y-3">
          <SectionLabel className="capitalize">{month}</SectionLabel>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {list.map((p) => {
              const order = selected.indexOf(p.id);
              const isSelected = order >= 0;
              return (
                <PaperCard
                  key={p.id}
                  className={cn(
                    "relative overflow-hidden p-0 transition-shadow",
                    isSelected && "ring-2 ring-lab-green",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="block w-full text-left"
                    aria-pressed={isSelected}
                    aria-label={`${formatDate(p.photo_date)} fotoğrafını karşılaştırma için seç`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Fizik — ${formatDate(p.photo_date)}`}
                      loading="lazy"
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </button>

                  {isSelected ? (
                    <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-lab-green font-mono text-xs font-bold text-white">
                      {order + 1}
                    </span>
                  ) : null}

                  {canDelete ? (
                    <form
                      action={deletePhysiquePhoto}
                      onSubmit={(e) => {
                        if (!confirm("Bu fotoğraf kalıcı olarak silinsin mi?"))
                          e.preventDefault();
                      }}
                      className="absolute right-2 top-2"
                    >
                      <input type="hidden" name="id" value={p.id} />
                      <button
                        type="submit"
                        aria-label="Fotoğrafı sil"
                        className="flex size-7 items-center justify-center rounded-md bg-black/35 text-white/90 backdrop-blur-sm transition-colors hover:bg-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </form>
                  ) : null}

                  <div className="flex items-baseline justify-between gap-2 p-2.5">
                    <span className="font-mono text-xs tabular-nums text-paper-foreground">
                      {formatDate(p.photo_date, "d MMM")}
                    </span>
                    {p.weight_kg != null ? (
                      <span className="font-mono text-xs tabular-nums text-paper-muted">
                        {formatNumber(p.weight_kg)} kg
                      </span>
                    ) : null}
                  </div>
                  {p.note ? (
                    <p className="line-clamp-1 px-2.5 pb-2 text-xs text-paper-muted">
                      {p.note}
                    </p>
                  ) : null}
                </PaperCard>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
