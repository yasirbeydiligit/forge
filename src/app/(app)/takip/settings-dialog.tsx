"use client";

import { useState, useTransition } from "react";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { saveTrackerSettings } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { METRICS, type Goals, type MetricKey } from "@/lib/metrics";
import { cn } from "@/lib/utils";

/**
 * Lets the athlete choose which metric columns appear in the weekly table and
 * set optional goals (the colouring center) in one place. Saves the whole
 * preference set at once.
 */
export function TrackerSettingsDialog({
  enabled,
  goals,
}: {
  enabled: MetricKey[];
  goals: Goals;
}) {
  const [open, setOpen] = useState(false);
  const [on, setOn] = useState<Set<MetricKey>>(() => new Set(enabled));
  const [goalText, setGoalText] = useState<Partial<Record<MetricKey, string>>>(
    () =>
      Object.fromEntries(
        Object.entries(goals).map(([k, v]) => [k, String(v)]),
      ) as Partial<Record<MetricKey, string>>,
  );
  const [pending, startTransition] = useTransition();

  function toggle(key: MetricKey, next: boolean) {
    setOn((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(key);
      else copy.delete(key);
      return copy;
    });
  }

  function save() {
    // Registry order; at least keep the table from going fully empty.
    const nextEnabled = METRICS.filter((m) => on.has(m.key)).map((m) => m.key);
    if (nextEnabled.length === 0) {
      toast.error("En az bir kolon açık olmalı.");
      return;
    }
    const nextGoals: Record<string, number | null> = {};
    for (const [k, text] of Object.entries(goalText)) {
      const trimmed = (text ?? "").trim();
      nextGoals[k] = trimmed === "" ? null : Number(trimmed);
    }
    startTransition(async () => {
      await saveTrackerSettings({ enabled: nextEnabled, goals: nextGoals });
      toast.success("Takip ayarları güncellendi.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal className="size-4" /> Kolonlar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Takip ayarları</DialogTitle>
          <DialogDescription>
            Takip etmek istediğin metrikleri seç. Hedef koyduklarında renkler
            hedefe göre, koymadıklarında kendi son dönem ortalamana göre belirir.
          </DialogDescription>
        </DialogHeader>

        <div className="divide-y divide-border/60">
          {METRICS.map((m) => {
            const isOn = on.has(m.key);
            return (
              <div key={m.key} className="flex items-center gap-3 py-2.5">
                <Switch
                  checked={isOn}
                  onCheckedChange={(v) => toggle(m.key, v)}
                  aria-label={`${m.label} kolonunu göster`}
                />
                <span
                  className={cn(
                    "flex-1 text-sm",
                    isOn ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {m.label}
                </span>

                {m.goalAllowed ? (
                  <div className="flex items-center gap-1.5">
                    <Input
                      className="h-8 w-20 text-center font-mono text-sm tabular-nums"
                      inputMode="decimal"
                      placeholder="hedef"
                      value={goalText[m.key] ?? ""}
                      onChange={(e) =>
                        setGoalText((prev) => ({
                          ...prev,
                          [m.key]: e.target.value,
                        }))
                      }
                      aria-label={`${m.label} hedefi`}
                    />
                    {m.unit ? (
                      <span className="w-7 font-mono text-xs text-muted-foreground">
                        {m.unit}
                      </span>
                    ) : (
                      <span className="w-7" />
                    )}
                  </div>
                ) : (
                  <span className="font-mono text-xs text-muted-foreground/70">
                    {m.unit ?? ""}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
