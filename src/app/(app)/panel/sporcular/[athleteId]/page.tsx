import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, ArrowLeft, Dumbbell, NotebookPen } from "lucide-react";

import { getInitials } from "@/components/shell/user-menu";
import { EmptyState } from "@/components/empty-state";
import { SessionView, type SessionRow } from "@/components/logbook/session-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { requireCoach } from "@/lib/auth";
import { formatDate, formatNumber } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DailyMetric } from "@/lib/types";

export const metadata: Metadata = { title: "Sporcu" };

export default async function AthleteDetailPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  await requireCoach();
  const { athleteId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: athlete } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", athleteId)
    .maybeSingle();
  if (!athlete) notFound();

  const [{ data: enrollmentsData }, { data: sessionsData }, { data: metricsData }] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select("id, status, program:programs(name)")
        .eq("athlete_id", athleteId),
      supabase
        .from("log_sessions")
        .select(
          "id, session_date, completed, notes, workout:workouts(name), log_sets(id, set_number, weight, reps, rir, notes, exercise_id, exercise:exercises(name))",
        )
        .eq("athlete_id", athleteId)
        .order("session_date", { ascending: false })
        .limit(25),
      supabase
        .from("daily_metrics")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("metric_date", { ascending: false })
        .limit(10),
    ]);

  const enrollments = (enrollmentsData ?? []) as {
    id: string;
    status: string;
    program: { name: string } | null;
  }[];
  const sessions = (sessionsData ?? []) as unknown as SessionRow[];
  const metrics = (metricsData ?? []) as DailyMetric[];

  return (
    <div className="space-y-6">
      <Link
        href="/panel/sporcular"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Sporcular
      </Link>

      <div className="flex items-center gap-4">
        <Avatar className="size-16 border border-border">
          {athlete.avatar_url ? (
            <AvatarImage src={athlete.avatar_url} alt={athlete.full_name} />
          ) : null}
          <AvatarFallback className="bg-secondary text-lg font-semibold">
            {getInitials(athlete.full_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {athlete.full_name}
          </h1>
          {athlete.bio ? (
            <p className="text-sm text-muted-foreground">{athlete.bio}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Sporcu</p>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <Dumbbell className="size-4" /> Kayıtlı programlar
        </h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz bir programa kayıtlı değil.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {enrollments.map((e) => (
              <Badge key={e.id} variant="secondary" className="rounded-full">
                {e.program?.name ?? "Program"}
              </Badge>
            ))}
          </div>
        )}
      </section>

      {metrics.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <Activity className="size-4" /> Günlük takip
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Tarih</th>
                  <th className="px-2 py-2 text-center font-medium">Kilo</th>
                  <th className="px-2 py-2 text-center font-medium">Uyku</th>
                  <th className="px-2 py-2 text-center font-medium">RHR</th>
                  <th className="px-2 py-2 text-center font-medium">Enerji</th>
                  <th className="px-2 py-2 text-center font-medium">Uyum</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {metrics.map((m) => (
                  <tr key={m.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 text-left font-sans text-muted-foreground">
                      {formatDate(m.metric_date, "d MMM")}
                    </td>
                    <td className="px-2 py-2 text-center">{formatNumber(m.weight)}</td>
                    <td className="px-2 py-2 text-center">{formatNumber(m.sleep_hours)}</td>
                    <td className="px-2 py-2 text-center">{m.resting_hr ?? "—"}</td>
                    <td className="px-2 py-2 text-center">{m.energy ?? "—"}</td>
                    <td className="px-2 py-2 text-center">{m.adherence ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <NotebookPen className="size-4" /> Antrenman geçmişi
        </h2>
        {sessions.length === 0 ? (
          <EmptyState
            icon={NotebookPen}
            title="Henüz kayıt yok"
            description="Bu sporcu henüz logbook'una antrenman işlememiş."
          />
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => (
              <SessionView key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
