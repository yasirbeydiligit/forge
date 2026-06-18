import type { Metadata } from "next";
import { CalendarDays, Check, Dumbbell, Plus } from "lucide-react";

import { enrollProgram, unenrollProgram } from "./actions";
import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Programlar" };

type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  workouts: { count: number }[];
};

export default async function AthleteProgramsPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const [{ data: programsData }, { data: enrollmentsData }] = await Promise.all([
    supabase
      .from("programs")
      .select("id, name, description, cover_url, workouts(count)")
      .eq("is_published", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("enrollments")
      .select("program_id")
      .eq("athlete_id", profile.id),
  ]);

  const programs = (programsData ?? []) as ProgramRow[];
  const enrolledIds = new Set(
    (enrollmentsData ?? []).map((e) => e.program_id),
  );

  return (
    <div>
      <PageHeader
        title="Programlar"
        description="Bir programa kaydol; antrenmanları takvimine düşsün."
      />

      {programs.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Henüz program yayında değil"
          description="Koçun yeni bir program yayınladığında burada görünecek."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => {
            const enrolled = enrolledIds.has(p.id);
            return (
              <PaperCard key={p.id} className="overflow-hidden p-0">
                <div className="relative aspect-[5/2] w-full bg-secondary">
                  {p.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.cover_url}
                      alt={p.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Dumbbell className="size-10 text-primary/40" />
                    </div>
                  )}
                  {enrolled ? (
                    <Badge className="absolute right-2 top-2 gap-1">
                      <Check className="size-3" /> Kayıtlı
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-3 p-4">
                  <div className="space-y-1">
                    <p className="font-serif text-lg text-paper-foreground">
                      {p.name}
                    </p>
                    {p.description ? (
                      <p className="line-clamp-2 text-sm text-paper-muted">
                        {p.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-paper-muted">
                      <CalendarDays className="size-3.5" />
                      {p.workouts[0]?.count ?? 0} antrenman günü
                    </span>
                    {enrolled ? (
                      <form action={unenrollProgram}>
                        <input type="hidden" name="programId" value={p.id} />
                        <Button variant="outline" size="sm" type="submit">
                          Kaydı bırak
                        </Button>
                      </form>
                    ) : (
                      <form action={enrollProgram}>
                        <input type="hidden" name="programId" value={p.id} />
                        <Button size="sm" type="submit">
                          <Plus className="size-4" /> Kaydol
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </PaperCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
