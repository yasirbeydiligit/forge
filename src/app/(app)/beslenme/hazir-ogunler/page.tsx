import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Trash2, UtensilsCrossed } from "lucide-react";

import { deleteMealTemplate } from "../actions";
import { TemplateEditDialog } from "./template-edit-dialog";
import {
  LabHeader,
  LabPage,
  PaperCard,
  SectionLabel,
} from "@/components/lab/lab";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MealTemplate } from "@/lib/types";

export const metadata: Metadata = { title: "Hazır öğünlerim" };

const MACRO_DOT = {
  green: "bg-lab-green",
  amber: "bg-lab-amber",
  violet: "bg-lab-violet",
} as const;

function MacroBadge({
  value,
  suffix,
  accent,
}: {
  value: number | null;
  suffix: string;
  accent: keyof typeof MACRO_DOT;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper-foreground/[0.04] px-2 py-0.5 font-mono text-[11px] tabular-nums text-paper-foreground">
      <span
        className={`size-1.5 rounded-full ${MACRO_DOT[accent]}`}
        aria-hidden
      />
      {value ?? 0}
      {suffix}
    </span>
  );
}

export default async function MealTemplatesPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("meal_templates")
    .select("*")
    .eq("athlete_id", profile.id)
    .order("name", { ascending: true });
  const templates = (data ?? []) as MealTemplate[];

  return (
    <LabPage>
      <LabHeader
        metaLeft="Beslenme"
        metaRight="Kütüphane"
        title="Hazır öğünlerim"
        subtitle={`${templates.length} kayıtlı öğün`}
      />

      <div className="mb-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/beslenme">
            <ChevronLeft className="size-4" /> Beslenme
          </Link>
        </Button>
      </div>

      <section className="space-y-3">
        <SectionLabel>Kayıtlı öğünler</SectionLabel>
        {templates.length === 0 ? (
          <PaperCard className="flex flex-col items-center gap-2 p-8 text-center">
            <UtensilsCrossed className="size-6 text-paper-muted" />
            <p className="font-serif text-lg italic text-paper-muted">
              Henüz hazır öğünün yok.
            </p>
            <p className="text-caption text-paper-muted">
              Bir öğün eklerken “hazır öğünlerime kaydet”i işaretleyince burada
              görünür.
            </p>
          </PaperCard>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <PaperCard key={t.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-paper-foreground">{t.name}</p>
                  {t.description ? (
                    <p className="text-sm text-paper-muted">{t.description}</p>
                  ) : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs tabular-nums text-paper-muted">
                      {(t.kcal ?? 0).toLocaleString("tr-TR")} kcal
                    </span>
                    <MacroBadge value={t.protein} suffix="P" accent="green" />
                    <MacroBadge value={t.carbs} suffix="K" accent="amber" />
                    <MacroBadge value={t.fat} suffix="Y" accent="violet" />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <TemplateEditDialog template={t} />
                  <form action={deleteMealTemplate}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="text-paper-muted transition-colors hover:text-destructive"
                      aria-label="Hazır öğünü sil"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </form>
                </div>
              </PaperCard>
            ))}
          </div>
        )}
      </section>
    </LabPage>
  );
}
