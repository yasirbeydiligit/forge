"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addMeal, type FormState } from "./actions";
import { MealFields, type MealFieldsInitial } from "./meal-form";
import { scaleMacros } from "@/lib/nutrition/macros";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { MealTemplate } from "@/lib/types";

const PORTIONS = [0.5, 1, 1.5, 2] as const;

export function MealDialog({
  date,
  templates,
}: {
  date: string;
  templates: MealTemplate[];
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "saved">("new");
  const [prefill, setPrefill] = useState<MealFieldsInitial | undefined>();
  // Bumping the key remounts MealFields so it re-seeds its controlled state.
  const [prefillKey, setPrefillKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [factor, setFactor] = useState<number>(1);

  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    addMeal,
    {},
  );

  const reset = () => {
    setTab("new");
    setPrefill(undefined);
    setPrefillKey((k) => k + 1);
    setSelectedId(null);
    setFactor(1);
  };

  useEffect(() => {
    if (state.ok) {
      toast.success("Öğün eklendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  function applyTemplate() {
    const t = templates.find((x) => x.id === selectedId);
    if (!t) return;
    const scaled = scaleMacros(t, factor);
    setPrefill({
      name: t.name,
      description: t.description,
      kcal: scaled.kcal,
      protein: scaled.protein,
      carbs: scaled.carbs,
      fat: scaled.fat,
    });
    setPrefillKey((k) => k + 1);
    setTab("new");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Öğün ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Öğün ekle</DialogTitle>
          <DialogDescription>
            Yediklerini ve makrolarını gir. Bilmediğin değerleri boş
            bırakabilirsin.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as "new" | "saved")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="new">Yeni</TabsTrigger>
            <TabsTrigger value="saved">Hazır öğünden</TabsTrigger>
          </TabsList>

          <TabsContent value="new" className="mt-4">
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="date" value={date} />
              <MealFields
                key={prefillKey}
                initial={prefill}
                showSaveAsTemplate
              />
              <DialogFooter>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Ekleniyor…" : "Ekle"}
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>

          <TabsContent value="saved" className="mt-4">
            {templates.length === 0 ? (
              <p className="rounded-lg border border-dashed border-paper-border px-4 py-8 text-center font-serif text-sm italic text-paper-muted">
                Henüz hazır öğünün yok. Bir öğün eklerken “hazır öğünlerime
                kaydet”i işaretle.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {templates.map((t) => {
                    const active = t.id === selectedId;
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => setSelectedId(t.id)}
                        aria-pressed={active}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                          active
                            ? "border-lab-green bg-lab-green/[0.06]"
                            : "border-paper-border hover:bg-paper-foreground/[0.03]",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-paper-foreground">
                          {t.name}
                        </span>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-paper-muted">
                          {(t.kcal ?? 0).toLocaleString("tr-TR")} kcal · {t.protein ?? 0}P
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-caption text-paper-muted">Porsiyon</span>
                  <div className="flex gap-1">
                    {PORTIONS.map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setFactor(p)}
                        aria-pressed={factor === p}
                        className={cn(
                          "rounded-md border px-2 py-1 font-mono text-xs tabular-nums transition-colors",
                          factor === p
                            ? "border-lab-green bg-lab-green/[0.06] text-paper-foreground"
                            : "border-paper-border text-paper-muted hover:text-paper-foreground",
                        )}
                      >
                        ×{p}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  type="button"
                  className="w-full"
                  disabled={!selectedId}
                  onClick={applyTemplate}
                >
                  Forma aktar
                </Button>
                <p className="text-caption text-paper-muted">
                  Seçtiğin öğün “Yeni” sekmesine dolar; orada düzeltip
                  ekleyebilirsin.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
