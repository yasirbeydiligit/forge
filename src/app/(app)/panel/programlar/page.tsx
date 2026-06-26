import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Dumbbell, Users } from "lucide-react";

import { createProgram, updateProgram } from "./actions";
import { ProgramDialog } from "@/components/programs/program-dialog";
import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Programlar" };

type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  is_published: boolean;
  workouts: { count: number }[];
  enrollments: { count: number }[];
};

export default async function ProgramsPage() {
  const coach = await requireCoach();
  const supabase = await createSupabaseServerClient();
  // The coach's own (community) programs — not athletes' personal programs,
  // which the coach can still read but manages nowhere here.
  const { data } = await supabase
    .from("programs")
    .select("id, name, description, cover_url, is_published, workouts(count), enrollments(count)")
    .eq("created_by", coach.id)
    .order("created_at", { ascending: false });

  const programs = (data ?? []) as ProgramRow[];

  return (
    <div>
      <PageHeader
        title="Programlar"
        description="Antrenman programlarını oluştur ve düzenle."
      >
        <ProgramDialog create={createProgram} update={updateProgram} showPublish />
      </PageHeader>

      {programs.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Henüz program yok"
          description="İlk programını oluştur, sonra antrenman günleri ve egzersizler ekle."
          action={<ProgramDialog create={createProgram} update={updateProgram} showPublish />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <Link key={p.id} href={`/panel/programlar/${p.id}`} className="group">
              <PaperCard className="h-full overflow-hidden p-0 transition-shadow group-hover:shadow-md">
                <div className="relative aspect-video w-full bg-secondary">
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
                  {!p.is_published ? (
                    <Badge
                      variant="secondary"
                      className="absolute right-2 top-2 bg-background/80"
                    >
                      Taslak
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-2 p-4">
                  <p className="font-serif text-lg text-paper-foreground">{p.name}</p>
                  {p.description ? (
                    <p className="line-clamp-2 text-sm text-paper-muted">
                      {p.description}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-4 pt-1 font-mono text-xs tabular-nums text-paper-muted">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" />
                      {p.workouts[0]?.count ?? 0} antrenman
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {p.enrollments[0]?.count ?? 0} sporcu
                    </span>
                  </div>
                </div>
              </PaperCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
