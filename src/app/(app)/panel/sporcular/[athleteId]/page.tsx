import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addWeeks, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { Activity, ArrowLeft, Dumbbell, NotebookPen } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { SessionView, type SessionRow } from "@/components/logbook/session-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { requireCoach } from "@/lib/auth";
import { formatDate, formatNumber, getInitials } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DailyMetric } from "@/lib/types";

import { loadCoachWeekly } from "./coach-weekly-loader";
import { CoachWeeklyReportView } from "./coach-weekly-report";

export const metadata: Metadata = { title: "Sporcu" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export default async function AthleteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  await requireCoach();
  const { athleteId } = await params;
  const { week } = await searchParams;
  const supabase = await createSupabaseServerClient();

  // Week selection (Mon–Sun) from ?week=YYYY-MM-DD; defaults to the current week.
  const ref = week && ISO_DATE.test(week) ? parseISO(week) : new Date();
  const weekStartD = startOfWeek(ref, { weekStartsOn: 1 });
  const weekEndD = endOfWeek(ref, { weekStartsOn: 1 });
  const weekStart = format(weekStartD, "yyyy-MM-dd");
  const weekEnd = format(weekEndD, "yyyy-MM-dd");

  const { data: athlete } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", athleteId)
    .maybeSingle();
  if (!athlete) notFound();

  const [
    { data: enrollmentsData },
    { data: ownProgramsData },
    { data: sessionsData },
    { data: metricsData },
    weekly,
  ] = await Promise.all([
      supabase
        .from("enrollments")
        .select("id, status, program:programs(name)")
        .eq("athlete_id", athleteId),
      // The athlete's own personal programs — coach read-only (RLS), for tracking.
      supabase
        .from("programs")
        .select("id, name, description, workouts(count)")
        .eq("created_by", athleteId)
        .order("created_at", { ascending: false }),
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
      loadCoachWeekly(supabase, athleteId, weekStart, weekEnd),
    ]);

  const base = `/panel/sporcular/${athleteId}`;
  const prevHref = `${base}?week=${format(addWeeks(weekStartD, -1), "yyyy-MM-dd")}`;
  const nextHref = `${base}?week=${format(addWeeks(weekStartD, 1), "yyyy-MM-dd")}`;
  const weekLabel = `${format(weekStartD, "d MMM")} – ${format(weekEndD, "d MMM")}`;

  const enrollments = (enrollmentsData ?? []) as {
    id: string;
    status: string;
    program: { name: string } | null;
  }[];
  const sessions = (sessionsData ?? []) as unknown as SessionRow[];
  const metrics = (metricsData ?? []) as DailyMetric[];
  const ownPrograms = (ownProgramsData ?? []) as {
    id: string;
    name: string;
    description: string | null;
    workouts: { count: number }[];
  }[];

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

      {ownPrograms.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <NotebookPen className="size-4" /> Kendi programları
            <Badge variant="secondary" className="rounded-full">
              salt-okunur
            </Badge>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ownPrograms.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-border p-4"
              >
                <p className="font-medium">{p.name}</p>
                {p.description ? (
                  <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                    {p.description}
                  </p>
                ) : null}
                <p className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
                  {p.workouts[0]?.count ?? 0} antrenman günü
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <CoachWeeklyReportView
        report={weekly.report}
        plateaus={weekly.plateaus}
        weekLabel={weekLabel}
        prevHref={prevHref}
        nextHref={nextHref}
      />

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
