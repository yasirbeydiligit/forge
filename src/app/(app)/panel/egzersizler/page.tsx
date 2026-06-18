import type { Metadata } from "next";
import { Dumbbell, ExternalLink, Pencil } from "lucide-react";

import { deleteExercise } from "./actions";
import { ExerciseDialog } from "./exercise-dialog";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Exercise } from "@/lib/types";
import { Trash2 } from "lucide-react";

export const metadata: Metadata = { title: "Egzersiz Kütüphanesi" };

export default async function ExercisesPage() {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("exercises")
    .select("*")
    .order("category", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });

  const exercises = (data ?? []) as Exercise[];
  const grouped = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const key = ex.category ?? "Diğer";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ex);
  }

  return (
    <div>
      <PageHeader
        title="Egzersiz Kütüphanesi"
        description="Programlarında kullanacağın egzersizleri buradan yönet."
      >
        <ExerciseDialog />
      </PageHeader>

      {exercises.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Henüz egzersiz yok"
          description="İlk egzersizini ekleyerek kütüphaneni oluşturmaya başla."
          action={<ExerciseDialog />}
        />
      ) : (
        <div className="space-y-8">
          {[...grouped.entries()].map(([category, items]) => (
            <section key={category}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {category}
                </h2>
                <Badge variant="secondary" className="rounded-full">
                  {items.length}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((ex) => (
                  <PaperCard key={ex.id} className="flex flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-serif text-lg text-paper-foreground">
                          {ex.name}
                        </p>
                        {ex.category ? (
                          <span className="mt-1 inline-block rounded-full border border-paper-border px-2 py-0.5 text-xs text-paper-muted">
                            {ex.category}
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center text-paper-foreground">
                        <ExerciseDialog
                          exercise={ex}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-paper-muted hover:bg-paper-foreground/[0.06] hover:text-paper-foreground"
                            >
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <ConfirmButton
                          action={deleteExercise}
                          fields={{ id: ex.id }}
                          title="Egzersizi sil"
                          description={`"${ex.name}" silinsin mi? Programlarda kullanılıyorsa silinemeyebilir.`}
                          triggerClassName="text-paper-muted hover:bg-paper-foreground/[0.06]"
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </ConfirmButton>
                      </div>
                    </div>
                    {ex.description ? (
                      <p className="line-clamp-2 text-sm text-paper-muted">
                        {ex.description}
                      </p>
                    ) : null}
                    {ex.video_url ? (
                      <a
                        href={ex.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-lab-green hover:underline"
                      >
                        <ExternalLink className="size-3" /> Video
                      </a>
                    ) : null}
                  </PaperCard>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
