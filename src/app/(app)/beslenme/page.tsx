import type { Metadata } from "next";
import Link from "next/link";
import { addDays, parseISO, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Trash2, UtensilsCrossed } from "lucide-react";

import { deleteMeal } from "./actions";
import { MealDialog } from "./meal-dialog";
import { TargetsDialog } from "./targets-dialog";
import {
  LabHeader,
  LabPage,
  PaperCard,
  SectionLabel,
} from "@/components/lab/lab";
import { InsightNotes } from "@/components/library/insight-note";
import { MacroBar } from "@/components/nutrition/macro-bar";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { formatDate, toDateKey } from "@/lib/format";
import { getAthleteInsights } from "@/lib/rag/insights-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Meal, NutritionTarget } from "@/lib/types";

export const metadata: Metadata = { title: "Beslenme" };

const sum = (meals: Meal[], key: "kcal" | "protein" | "carbs" | "fat") =>
  meals.reduce((acc, m) => acc + (m[key] ?? 0), 0);

export default async function NutritionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const profile = await requireProfile();
  const { date: dateParam } = await searchParams;
  const date =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? parseISO(dateParam)
      : new Date();
  const dateKey = toDateKey(date);
  const prevKey = toDateKey(subDays(date, 1));
  const nextKey = toDateKey(addDays(date, 1));

  const supabase = await createSupabaseServerClient();
  const [{ data: targetData }, { data: mealsData }] = await Promise.all([
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("athlete_id", profile.id)
      .maybeSingle(),
    supabase
      .from("meals")
      .select("*")
      .eq("athlete_id", profile.id)
      .eq("meal_date", dateKey)
      .order("eaten_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true }),
  ]);

  const target = targetData as NutritionTarget | null;
  const meals = (mealsData ?? []) as Meal[];

  const insights = await getAthleteInsights(supabase, profile.id, "nutrition");

  const totalKcal = sum(meals, "kcal");
  const remaining =
    target?.kcal != null ? target.kcal - totalKcal : null;

  return (
    <LabPage>
      <LabHeader
        metaLeft={formatDate(dateKey, "EEEE")}
        metaRight={`Gün`}
        title={formatDate(dateKey, "d MMMM yyyy")}
        subtitle={`${meals.length} öğün${target?.kcal ? ` · hedef ${target.kcal} kcal` : ""}`}
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button asChild variant="outline" size="icon">
            <Link href={`/beslenme?date=${prevKey}`} aria-label="Önceki gün">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon">
            <Link href={`/beslenme?date=${nextKey}`} aria-label="Sonraki gün">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="flex gap-2">
          <TargetsDialog target={target} />
          <MealDialog date={dateKey} />
        </div>
      </div>

      <PaperCard className="p-5">
        <div className="flex items-baseline justify-between">
          <SectionLabel className="text-paper-muted">Bugün</SectionLabel>
          {remaining != null ? (
            <span className="text-xs text-paper-muted">
              {remaining >= 0
                ? `${remaining} kcal kaldı`
                : `${Math.abs(remaining)} kcal aşıldı`}
            </span>
          ) : null}
        </div>
        <p className="mt-1 font-serif text-3xl tabular-nums text-paper-foreground">
          {totalKcal.toLocaleString("tr-TR")}
          {target?.kcal ? (
            <span className="text-xl text-paper-muted">
              {" "}
              / {target.kcal.toLocaleString("tr-TR")}
            </span>
          ) : null}
          <span className="ml-1 text-sm font-normal text-paper-muted">kcal</span>
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MacroBar
            label="Protein"
            value={sum(meals, "protein")}
            target={target?.protein ?? null}
            accent="green"
          />
          <MacroBar
            label="Karbonhidrat"
            value={sum(meals, "carbs")}
            target={target?.carbs ?? null}
            accent="amber"
          />
          <MacroBar
            label="Yağ"
            value={sum(meals, "fat")}
            target={target?.fat ?? null}
            accent="violet"
          />
        </div>
      </PaperCard>

      <InsightNotes insights={insights} className="mt-4 space-y-3" />

      <section className="mt-8 space-y-3">
        <SectionLabel>Zaman çizelgesi</SectionLabel>
        {meals.length === 0 ? (
          <PaperCard className="flex flex-col items-center gap-2 p-8 text-center">
            <UtensilsCrossed className="size-6 text-paper-muted" />
            <p className="font-serif text-lg italic text-paper-muted">
              Bu güne henüz öğün eklenmedi.
            </p>
          </PaperCard>
        ) : (
          <div className="space-y-2">
            {meals.map((m) => (
              <PaperCard key={m.id} className="flex items-start gap-3 p-4">
                <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-paper-muted">
                  {m.eaten_at ? m.eaten_at.slice(0, 5) : "—"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-paper-foreground">{m.name}</p>
                  {m.description ? (
                    <p className="text-sm text-paper-muted">{m.description}</p>
                  ) : null}
                  <p className="mt-0.5 font-mono text-xs tabular-nums text-paper-muted">
                    {(m.kcal ?? 0).toLocaleString("tr-TR")} kcal · {m.protein ?? 0}P
                    · {m.carbs ?? 0}K · {m.fat ?? 0}Y
                  </p>
                </div>
                <form action={deleteMeal} className="shrink-0">
                  <input type="hidden" name="id" value={m.id} />
                  <button
                    type="submit"
                    className="text-paper-muted transition-colors hover:text-destructive"
                    aria-label="Öğünü sil"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </form>
              </PaperCard>
            ))}
          </div>
        )}
      </section>
    </LabPage>
  );
}
