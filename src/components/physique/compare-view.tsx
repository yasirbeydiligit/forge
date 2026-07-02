"use client";

import { X } from "lucide-react";

import { PaperCard } from "@/components/lab/lab";
import { formatDate, formatNumber } from "@/lib/format";

export type ComparablePhoto = {
  id: string;
  photo_date: string;
  note: string | null;
  weight_kg: number | string | null;
  url: string;
};

const num = (v: number | string | null): number | null => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Two photos side by side, earlier on the left, with the date/weight delta. */
export function CompareView({
  a,
  b,
  onClose,
}: {
  a: ComparablePhoto;
  b: ComparablePhoto;
  onClose: () => void;
}) {
  const [before, after] = a.photo_date <= b.photo_date ? [a, b] : [b, a];
  const dayGap = Math.round(
    (new Date(after.photo_date).getTime() - new Date(before.photo_date).getTime()) /
      86400000,
  );
  const wBefore = num(before.weight_kg);
  const wAfter = num(after.weight_kg);
  const delta = wBefore != null && wAfter != null ? wAfter - wBefore : null;

  const meta = [
    `${dayGap} gün`,
    delta != null
      ? `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${formatNumber(Math.abs(delta))} kg`
      : null,
  ].filter(Boolean);

  return (
    <PaperCard className="p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-label text-paper-muted">Karşılaştırma</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-lab-green">
            Δ {meta.join(" · ")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Karşılaştırmayı kapat"
            className="flex size-7 items-center justify-center rounded-md text-paper-muted transition-colors hover:bg-paper-foreground/[0.06] hover:text-paper-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { photo: before, tag: "Önce" },
          { photo: after, tag: "Sonra" },
        ].map(({ photo, tag }) => (
          <figure key={photo.id} className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-paper-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`${tag} — ${formatDate(photo.photo_date)}`}
                className="aspect-[3/4] w-full object-cover"
              />
            </div>
            <figcaption className="flex items-baseline justify-between gap-2">
              <span className="font-serif text-sm italic text-paper-muted">
                {tag}
              </span>
              <span className="font-mono text-xs tabular-nums text-paper-foreground">
                {formatDate(photo.photo_date, "d MMM yyyy")}
                {num(photo.weight_kg) != null
                  ? ` · ${formatNumber(photo.weight_kg)} kg`
                  : ""}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </PaperCard>
  );
}
