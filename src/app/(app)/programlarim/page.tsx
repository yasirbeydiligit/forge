import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Dumbbell, Plus } from "lucide-react";

import { createProgram, updateProgram } from "./actions";
import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { ProgramDialog } from "@/components/programs/program-dialog";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Programlarım" };

type ProgramRow = {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  workouts: { count: number }[];
};

export default async function MyProgramsPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("programs")
    .select("id, name, description, cover_url, workouts(count)")
    .eq("created_by", profile.id)
    .order("created_at", { ascending: false });
  const programs = (data ?? []) as ProgramRow[];

  const addTrigger = (
    <Button>
      <Plus className="size-4" /> Yeni program
    </Button>
  );

  return (
    <div>
      <PageHeader
        title="Programlarım"
        description="Kendi antrenman programını kur, egzersizlerini ekle ve takvimine ata."
      >
        <ProgramDialog
          create={createProgram}
          update={updateProgram}
          trigger={addTrigger}
        />
      </PageHeader>

      {programs.length === 0 ? (
        <EmptyState
          icon={Dumbbell}
          title="Henüz kendi programın yok"
          description="İlk programını oluştur; antrenman günleri ve egzersizler ekleyip takvimine ata."
          action={
            <ProgramDialog
              create={createProgram}
              update={updateProgram}
              trigger={addTrigger}
            />
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <Link key={p.id} href={`/programlarim/${p.id}`} className="group">
              <PaperCard className="h-full overflow-hidden p-0 transition-shadow group-hover:shadow-md">
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
                </div>
                <div className="space-y-2 p-4">
                  <p className="font-serif text-lg text-paper-foreground">
                    {p.name}
                  </p>
                  {p.description ? (
                    <p className="line-clamp-2 text-sm text-paper-muted">
                      {p.description}
                    </p>
                  ) : null}
                  <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-paper-muted">
                    <CalendarDays className="size-3.5" />
                    {p.workouts[0]?.count ?? 0} antrenman günü
                  </span>
                </div>
              </PaperCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
