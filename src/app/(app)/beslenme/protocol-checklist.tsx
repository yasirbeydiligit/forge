"use client";

import { useOptimistic, useTransition } from "react";
import { Check } from "lucide-react";

import { toggleProtocol } from "./actions";
import { PaperCard, SectionLabel } from "@/components/lab/lab";
import {
  PROTOCOL_TIMING_LABEL_TR,
  PROTOCOL_TIMING_ORDER,
  sortByTiming,
} from "@/lib/nutrition/protocols";
import { cn } from "@/lib/utils";

export type ProtocolItem = {
  id: string;
  name: string;
  timing: string;
  instructions: string | null;
  order_index: number;
  done: boolean;
  completedAt: string | null;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The athlete's assigned protocols for the day, as checkable boxes grouped by
 * time-of-day. Compliance, not macros: ticking a box records a completion (with
 * a timestamp). Optimistic so the check responds instantly, then settles on the
 * revalidated server state.
 */
export function ProtocolChecklist({
  date,
  protocols,
}: {
  date: string;
  protocols: ProtocolItem[];
}) {
  const [items, setDone] = useOptimistic(
    protocols,
    (state, { id, done }: { id: string; done: boolean }) =>
      state.map((p) =>
        p.id === id
          ? { ...p, done, completedAt: done ? new Date().toISOString() : null }
          : p,
      ),
  );
  const [, startTransition] = useTransition();

  function toggle(id: string, done: boolean) {
    startTransition(async () => {
      setDone({ id, done });
      const fd = new FormData();
      fd.set("protocolId", id);
      fd.set("date", date);
      fd.set("done", done ? "1" : "0");
      await toggleProtocol(fd);
    });
  }

  const sorted = sortByTiming(items);
  const doneCount = items.filter((p) => p.done).length;
  const groups = PROTOCOL_TIMING_ORDER.map((timing) => ({
    timing,
    list: sorted.filter((p) => p.timing === timing),
  })).filter((g) => g.list.length > 0);

  return (
    <PaperCard className="p-5">
      <div className="flex items-baseline justify-between">
        <SectionLabel className="text-paper-muted">Protokoller</SectionLabel>
        <span className="font-mono text-xs tabular-nums text-paper-muted">
          {doneCount} / {items.length}
        </span>
      </div>

      <div className="mt-3 space-y-4">
        {groups.map((g) => (
          <div key={g.timing}>
            <p className="text-caption uppercase tracking-wide text-paper-muted">
              {PROTOCOL_TIMING_LABEL_TR[g.timing]}
            </p>
            <div className="mt-1.5 space-y-1.5">
              {g.list.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggle(p.id, !p.done)}
                  aria-pressed={p.done}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    p.done
                      ? "border-lab-green/40 bg-lab-green/[0.05]"
                      : "border-paper-border hover:bg-paper-foreground/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      p.done
                        ? "border-lab-green bg-lab-green text-white"
                        : "border-paper-border",
                    )}
                    aria-hidden
                  >
                    {p.done ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-paper-foreground">
                        {p.name}
                      </span>
                      {p.done && p.completedAt ? (
                        <span className="shrink-0 font-mono text-[10px] tabular-nums text-lab-green">
                          {fmtTime(p.completedAt)}
                        </span>
                      ) : null}
                    </span>
                    {p.instructions ? (
                      <span className="mt-0.5 block text-sm text-paper-muted">
                        {p.instructions}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PaperCard>
  );
}
