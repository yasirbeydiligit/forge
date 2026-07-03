import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addWeeks, endOfWeek, format, parseISO, startOfWeek, subDays } from "date-fns";
import {
  Activity,
  ArrowLeft,
  Camera,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  FlaskConical,
  NotebookPen,
} from "lucide-react";

import { toggleAssignment } from "../../protokoller/actions";
import { EmptyState } from "@/components/empty-state";
import { SectionLabel } from "@/components/lab/lab";
import { SessionView, type SessionRow } from "@/components/logbook/session-view";
import { AlertGroups } from "@/components/triage/alert-item";
import { ScoreRing } from "@/components/triage/score-ring";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { WeekSwitcher } from "@/components/week-switcher";
import { requireCoach } from "@/lib/auth";
import { formatDate, formatNumber, formatRelative, getInitials } from "@/lib/format";
import {
  PROTOCOL_TIMING_LABEL_TR,
  sortByTiming,
  type ProtocolTiming,
} from "@/lib/nutrition/protocols";
import { signPhysiquePaths } from "@/lib/physique";
import { GOAL_LABEL_TR, ageFrom } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadTriageForAthlete } from "@/lib/triage/load-triage";
import type { AlertTab, TriageResult } from "@/lib/triage/types";
import type {
  CardioSession,
  DailyMetric,
  PhysiquePhoto,
  ProfileDetails,
  ProtocolTemplate,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { loadCoachWeekly } from "./coach-weekly-loader";
import { CoachWeeklyReportView } from "./coach-weekly-report";
import { loadNutritionWeekly } from "./nutrition-weekly-loader";
import { NutritionWeeklyReportView } from "./nutrition-weekly-report";
import {
  ExerciseHistoryView,
  type ExerciseOption,
  type HistorySet,
} from "./exercise-history-view";
import { QuickMessage, type QuickMessagePost } from "./quick-message";
import { CoachTrackerWeek } from "./tracker-week-view";
import {
  DEFAULT_PROGRESS_WEEKS,
  MAX_PROGRESS_WEEKS,
  loadTrainingProgress,
} from "./training-progress-loader";
import { TrainingProgressView, type WindowOption } from "./training-progress-view";

export const metadata: Metadata = { title: "Sporcu" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const TABS = ["genel", "antrenman", "beslenme", "takip", "fizik"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  genel: "Genel",
  antrenman: "Antrenman",
  beslenme: "Beslenme",
  takip: "Takip",
  fizik: "Fizik",
};

type WeekNav = {
  weekLabel: string;
  prevHref: string;
  nextHref: string;
  currentHref: string;
  isCurrentWeek: boolean;
};

export default async function AthleteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ athleteId: string }>;
  searchParams: Promise<{ week?: string; tab?: string; win?: string; ex?: string }>;
}) {
  await requireCoach();
  const { athleteId } = await params;
  const { week, tab: tabParam, win: winParam, ex } = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(tabParam ?? "")
    ? (tabParam as Tab)
    : "genel";
  const winParsed = Number.parseInt(winParam ?? "", 10);
  const winWeeks = Number.isFinite(winParsed)
    ? Math.min(Math.max(winParsed, 1), MAX_PROGRESS_WEEKS)
    : DEFAULT_PROGRESS_WEEKS;
  const supabase = await createSupabaseServerClient();

  // Week selection (Mon–Sun) from ?week=YYYY-MM-DD; defaults to the current week.
  const ref = week && ISO_DATE.test(week) ? parseISO(week) : new Date();
  const weekStartD = startOfWeek(ref, { weekStartsOn: 1 });
  const weekEndD = endOfWeek(ref, { weekStartsOn: 1 });
  const weekStart = format(weekStartD, "yyyy-MM-dd");
  const weekEnd = format(weekEndD, "yyyy-MM-dd");

  // Always needed: identity, profile meta, triage, recent feed posts (quick touch).
  const [{ data: athlete }, { data: detailsData }, triage, { data: postsData }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", athleteId).maybeSingle(),
      supabase
        .from("profile_details")
        .select("*")
        .eq("user_id", athleteId)
        .maybeSingle(),
      loadTriageForAthlete(athleteId),
      supabase
        .from("feed_posts")
        .select("id, body, is_question, answered, created_at")
        .eq("author_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
  if (!athlete) notFound();

  const details = detailsData as ProfileDetails | null;
  const age = ageFrom(details?.birth_date);
  const profileMeta = [
    details?.goal ? GOAL_LABEL_TR[details.goal] : null,
    details?.weekly_target_days
      ? `hedef ${details.weekly_target_days} gün/hafta`
      : null,
    age != null ? `${age} yaş` : null,
    details?.height_cm ? `${details.height_cm} cm` : null,
  ].filter(Boolean);

  const posts: QuickMessagePost[] = (postsData ?? []).map((p) => ({
    id: p.id,
    body: p.body,
    isQuestion: p.is_question,
    answered: p.answered,
    createdAt: p.created_at,
  }));

  const base = `/panel/sporcular/${athleteId}`;
  const weekQS = week ? `&week=${week}` : "";
  const tabHref = (t: Tab) => `${base}?tab=${t}${weekQS}`;
  const weekLabel = `${format(weekStartD, "d MMM")} – ${format(weekEndD, "d MMM")}`;
  const isCurrentWeek =
    weekStart === format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekNav = {
    weekLabel,
    prevHref: `${base}?tab=${tab}&week=${format(addWeeks(weekStartD, -1), "yyyy-MM-dd")}`,
    nextHref: `${base}?tab=${tab}&week=${format(addWeeks(weekStartD, 1), "yyyy-MM-dd")}`,
    currentHref: `${base}?tab=${tab}`,
    isCurrentWeek,
  };

  const alertCountFor = (t: Tab) =>
    triage?.alerts.filter((a) => a.tab === (t as AlertTab)).length ?? 0;

  return (
    <div className="space-y-6">
      <Link
        href="/panel/sporcular"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Sporcular
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar className="size-16 border border-border">
          {athlete.avatar_url ? (
            <AvatarImage src={athlete.avatar_url} alt={athlete.full_name} />
          ) : null}
          <AvatarFallback className="bg-secondary text-lg font-semibold">
            {getInitials(athlete.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {athlete.full_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {athlete.bio ?? "Sporcu"}
          </p>
          {profileMeta.length ? (
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              {profileMeta.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <QuickMessage
            athleteId={athleteId}
            athleteName={athlete.full_name}
            posts={posts}
          />
          {triage ? <ScoreRing score={triage.score} band={triage.band} /> : null}
        </div>
      </div>

      {/* Tab bar — server-rendered links so the URL is shareable. */}
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
        {TABS.map((t) => {
          const active = t === tab;
          const count = t === "genel" ? (triage?.alerts.length ?? 0) : alertCountFor(t);
          return (
            <Link
              key={t}
              href={tabHref(t)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors duration-[var(--dur-fast)] ease-soft",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TAB_LABEL[t]}
              {count > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-lab-rose/10 px-1 font-mono text-[10px] font-semibold text-lab-rose">
                  {count}
                </span>
              ) : null}
              {active ? (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {tab === "genel" ? (
        <GenelTab supabase={supabase} athleteId={athleteId} triage={triage} />
      ) : null}
      {tab === "antrenman" ? (
        <AntrenmanTab
          athleteId={athleteId}
          triage={triage}
          weekStart={weekStart}
          weekEnd={weekEnd}
          weekNav={weekNav}
          week={week}
          winWeeks={winWeeks}
          selectedExercise={ex}
        />
      ) : null}
      {tab === "beslenme" ? (
        <BeslenmeTab
          athleteId={athleteId}
          triage={triage}
          weekStart={weekStart}
          weekEnd={weekEnd}
          weekNav={weekNav}
        />
      ) : null}
      {tab === "takip" ? (
        <TakipTab
          athleteId={athleteId}
          triage={triage}
          weekStartD={weekStartD}
          weekStart={weekStart}
          weekEnd={weekEnd}
          weekNav={weekNav}
          profileGoal={details?.goal ?? null}
        />
      ) : null}
      {tab === "fizik" ? <FizikTab athleteId={athleteId} /> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared bits                                                               */
/* -------------------------------------------------------------------------- */

function TabAlerts({
  triage,
  athleteId,
  tab,
}: {
  triage: TriageResult | null;
  athleteId: string;
  tab?: AlertTab;
}) {
  const alerts = tab
    ? (triage?.alerts.filter((a) => a.tab === tab) ?? [])
    : (triage?.alerts ?? []);
  if (alerts.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionLabel>Açık uyarılar</SectionLabel>
      <AlertGroups alerts={alerts} athleteId={athleteId} detail />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Genel                                                                     */
/* -------------------------------------------------------------------------- */

async function GenelTab({
  supabase,
  athleteId,
  triage,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  athleteId: string;
  triage: TriageResult | null;
}) {
  const [{ data: enrollmentsData }, { data: ownProgramsData }] =
    await Promise.all([
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
    ]);

  const enrollments = (enrollmentsData ?? []) as {
    id: string;
    status: string;
    program: { name: string } | null;
  }[];
  const ownPrograms = (ownProgramsData ?? []) as {
    id: string;
    name: string;
    description: string | null;
    workouts: { count: number }[];
  }[];

  return (
    <div className="space-y-6">
      {triage && triage.alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Açık uyarı yok — her şey yolunda görünüyor.
          {triage.lastActivity
            ? ` Son aktivite ${formatRelative(triage.lastActivity)}.`
            : ""}
        </p>
      ) : (
        <TabAlerts triage={triage} athleteId={athleteId} />
      )}

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
              <div key={p.id} className="rounded-xl border border-border p-4">
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Antrenman                                                                 */
/* -------------------------------------------------------------------------- */

async function AntrenmanTab({
  athleteId,
  triage,
  weekStart,
  weekEnd,
  weekNav,
  week,
  winWeeks,
  selectedExercise,
}: {
  athleteId: string;
  triage: TriageResult | null;
  weekStart: string;
  weekEnd: string;
  weekNav: WeekNav;
  week?: string;
  winWeeks: number;
  selectedExercise?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const [progress, weekly, { data: sessionsData }, { data: allSetsData }] =
    await Promise.all([
      loadTrainingProgress(supabase, athleteId, winWeeks),
      loadCoachWeekly(supabase, athleteId, weekStart, weekEnd),
      supabase
        .from("log_sessions")
        .select(
          "id, session_date, completed, notes, workout:workouts(name), log_sets(id, set_number, weight, reps, rir, notes, exercise_id, exercise:exercises(name))",
        )
        .eq("athlete_id", athleteId)
        .order("session_date", { ascending: false })
        .limit(25),
      // Every exercise the athlete ever logged (for the history picker).
      supabase
        .from("log_sets")
        .select("exercise_id, exercise:exercises(name), session:log_sessions!inner(athlete_id)")
        .eq("log_sessions.athlete_id", athleteId),
    ]);
  const sessions = (sessionsData ?? []) as unknown as SessionRow[];

  // Aggregate the all-time exercise list, most-trained first.
  const optionMap = new Map<string, ExerciseOption>();
  for (const row of (allSetsData ?? []) as unknown as {
    exercise_id: string;
    exercise: { name: string } | null;
  }[]) {
    const entry = optionMap.get(row.exercise_id) ?? {
      exerciseId: row.exercise_id,
      name: row.exercise?.name ?? "Egzersiz",
      totalSets: 0,
    };
    entry.totalSets += 1;
    optionMap.set(row.exercise_id, entry);
  }
  const options = [...optionMap.values()].sort((a, b) => b.totalSets - a.totalSets);
  const selectedId =
    options.find((o) => o.exerciseId === selectedExercise)?.exerciseId ??
    options[0]?.exerciseId ??
    null;

  // Full set history of the selected exercise.
  let historySets: HistorySet[] = [];
  if (selectedId) {
    const { data: exSets } = await supabase
      .from("log_sets")
      .select("set_number, weight, reps, rir, session:log_sessions!inner(athlete_id, session_date)")
      .eq("log_sessions.athlete_id", athleteId)
      .eq("exercise_id", selectedId);
    historySets = ((exSets ?? []) as unknown as {
      set_number: number;
      weight: number | null;
      reps: number | null;
      rir: number | null;
      session: { session_date: string } | null;
    }[]).map((r) => ({
      date: r.session?.session_date ?? "",
      setNumber: r.set_number,
      weight: r.weight != null ? Number(r.weight) : null,
      reps: r.reps,
      rir: r.rir != null ? Number(r.rir) : null,
    }));
  }

  // Tab-preserving query strings for the window pills + exercise chips.
  const base = `/panel/sporcular/${athleteId}`;
  const qs = (over: { win?: number; ex?: string }) => {
    const params = new URLSearchParams({ tab: "antrenman" });
    if (week) params.set("week", week);
    const winValue = over.win ?? winWeeks;
    if (winValue !== DEFAULT_PROGRESS_WEEKS) params.set("win", String(winValue));
    const exValue = over.ex ?? selectedExercise;
    if (exValue) params.set("ex", exValue);
    return `${base}?${params.toString()}`;
  };
  const windowOptions: WindowOption[] = [1, 4, 8, 12].map((weeks) => ({
    weeks,
    href: qs({ win: weeks }),
    active: weeks === winWeeks,
  }));
  const formHidden: Record<string, string> = { tab: "antrenman" };
  if (week) formHidden.week = week;
  if (selectedExercise) formHidden.ex = selectedExercise;

  return (
    <div className="space-y-6">
      <TabAlerts triage={triage} athleteId={athleteId} tab="antrenman" />

      <TrainingProgressView
        report={progress.report}
        windowWeeks={winWeeks}
        windowOptions={windowOptions}
        formAction={base}
        formHidden={formHidden}
      />

      <WeekSwitcher {...weekNav} />

      <CoachWeeklyReportView
        report={weekly.report}
        plateaus={weekly.plateaus}
        prs={weekly.prs}
      />

      <ExerciseHistoryView
        options={options}
        selectedId={selectedId}
        sets={historySets}
        hrefFor={(exerciseId) => qs({ ex: exerciseId })}
      />

      {/* Raw set logs stay one click away — the digested reports above are the
          default reading surface for the coach. */}
      <section>
        <details className="group">
          <summary className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <ChevronDown className="size-4 transition-transform duration-[var(--dur-base)] ease-soft group-open:rotate-180" />
            <NotebookPen className="size-4" /> Ham seans geçmişi
            <span className="font-mono text-xs normal-case tracking-normal">
              ({sessions.length})
            </span>
          </summary>
          <div className="mt-3">
            {sessions.length === 0 ? (
              <EmptyState
                icon={NotebookPen}
                title="Henüz kayıt yok"
                description="Bu sporcu henüz logbook'una antrenman işlememiş."
              />
            ) : (
              <div className="space-y-4">
                {sessions.map((s) => (
                  <div key={s.id} className="space-y-1.5">
                    <SessionView session={s} />
                    <Link
                      href={`/panel/sporcular/${athleteId}/seans/${s.id}`}
                      className="inline-flex items-center gap-1 px-1 text-xs font-medium text-lab-green hover:underline"
                    >
                      Kas raporunu gör
                      <ChevronRight className="size-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Beslenme                                                                  */
/* -------------------------------------------------------------------------- */

async function BeslenmeTab({
  athleteId,
  triage,
  weekStart,
  weekEnd,
  weekNav,
}: {
  athleteId: string;
  triage: TriageResult | null;
  weekStart: string;
  weekEnd: string;
  weekNav: WeekNav;
}) {
  const supabase = await createSupabaseServerClient();
  const [nutritionWeekly, { data: protocolData }, { data: athleteAssignmentData }] =
    await Promise.all([
      loadNutritionWeekly(supabase, athleteId, weekStart, weekEnd),
      supabase
        .from("protocol_templates")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true }),
      supabase
        .from("protocol_assignments")
        .select("protocol_id")
        .eq("athlete_id", athleteId),
    ]);

  const protocols = sortByTiming((protocolData ?? []) as ProtocolTemplate[]);
  const assignedIds = new Set(
    (athleteAssignmentData ?? []).map((a) => a.protocol_id),
  );

  return (
    <div className="space-y-6">
      <TabAlerts triage={triage} athleteId={athleteId} tab="beslenme" />

      <WeekSwitcher {...weekNav} />

      <NutritionWeeklyReportView report={nutritionWeekly} />

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <FlaskConical className="size-4" /> Protokol atamaları
        </h2>
        {protocols.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aktif protokol yok.{" "}
            <Link href="/panel/protokoller" className="text-lab-green hover:underline">
              Protokol oluştur
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {protocols.map((p) => {
              const assigned = assignedIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {p.name}
                      </span>
                      <Badge
                        variant="secondary"
                        className="rounded-full text-[11px]"
                      >
                        {PROTOCOL_TIMING_LABEL_TR[p.timing as ProtocolTiming] ??
                          p.timing}
                      </Badge>
                    </div>
                    {p.instructions ? (
                      <p className="mt-0.5 truncate text-sm text-muted-foreground">
                        {p.instructions}
                      </p>
                    ) : null}
                  </div>
                  <form action={toggleAssignment} className="shrink-0">
                    <input type="hidden" name="protocolId" value={p.id} />
                    <input type="hidden" name="athleteId" value={athleteId} />
                    <input
                      type="hidden"
                      name="assigned"
                      value={assigned ? "0" : "1"}
                    />
                    <button
                      type="submit"
                      className={
                        assigned
                          ? "rounded-md border border-lab-green/40 bg-lab-green/10 px-3 py-1.5 text-xs font-medium text-lab-green transition-colors hover:bg-lab-green/15"
                          : "rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                      }
                    >
                      {assigned ? "Atandı ✓" : "Ata"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Takip                                                                     */
/* -------------------------------------------------------------------------- */

/** Days of history before the shown week feeding each metric's baseline —
 * mirrors the athlete tracker page so both colour identically. */
const BASELINE_WINDOW_DAYS = 28;

async function TakipTab({
  athleteId,
  triage,
  weekStartD,
  weekStart,
  weekEnd,
  weekNav,
  profileGoal,
}: {
  athleteId: string;
  triage: TriageResult | null;
  weekStartD: Date;
  weekStart: string;
  weekEnd: string;
  weekNav: WeekNav;
  profileGoal: "muscle_gain" | "strength" | "fat_loss" | "maintenance" | null;
}) {
  const supabase = await createSupabaseServerClient();
  const baselineStart = format(subDays(weekStartD, BASELINE_WINDOW_DAYS), "yyyy-MM-dd");

  const [{ data: metricsData }, { data: settings }, { data: cardioData }] =
    await Promise.all([
      supabase
        .from("daily_metrics")
        .select("*")
        .eq("athlete_id", athleteId)
        .gte("metric_date", baselineStart)
        .lte("metric_date", weekEnd),
      supabase
        .from("tracker_settings")
        .select("enabled, goals")
        .eq("athlete_id", athleteId)
        .maybeSingle(),
      supabase
        .from("cardio_sessions")
        .select("*")
        .eq("athlete_id", athleteId)
        .gte("session_date", weekStart)
        .lte("session_date", weekEnd)
        .order("session_date", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
  const rows = (metricsData ?? []) as DailyMetric[];
  const cardio = (cardioData ?? []) as CardioSession[];

  return (
    <div className="space-y-6">
      <TabAlerts triage={triage} athleteId={athleteId} tab="takip" />

      <WeekSwitcher {...weekNav} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Henüz takip girişi yok"
          description="Bu sporcu günlük takip (check-in) girmemiş."
        />
      ) : (
        <CoachTrackerWeek
          weekStart={weekStartD}
          rows={rows}
          settingsEnabled={settings?.enabled}
          settingsGoals={settings?.goals}
          profileGoal={profileGoal}
          cardio={cardio}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Fizik                                                                     */
/* -------------------------------------------------------------------------- */

async function FizikTab({ athleteId }: { athleteId: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: physiqueData } = await supabase
    .from("physique_photos")
    .select("*")
    .eq("athlete_id", athleteId)
    .order("photo_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(8);

  const physique = (physiqueData ?? []) as PhysiquePhoto[];
  const physiqueUrls = await signPhysiquePaths(
    supabase,
    physique.map((p) => p.storage_path),
  );

  if (physique.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="Henüz fizik fotoğrafı yok"
        description="Bu sporcu fizik takibine fotoğraf eklememiş."
      />
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        <Camera className="size-4" /> Fizik takip
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {physique.map((p) => {
          const url = physiqueUrls.get(p.storage_path);
          if (!url) return null;
          return (
            <figure
              key={p.id}
              className="overflow-hidden rounded-xl border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Fizik — ${formatDate(p.photo_date)}`}
                loading="lazy"
                className="aspect-[3/4] w-full object-cover"
              />
              <figcaption className="flex items-baseline justify-between gap-2 p-2 font-mono text-xs tabular-nums">
                <span>{formatDate(p.photo_date, "d MMM")}</span>
                {p.weight_kg != null ? (
                  <span className="text-muted-foreground">
                    {formatNumber(p.weight_kg)} kg
                  </span>
                ) : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
      <Link
        href={`/panel/sporcular/${athleteId}/fizik`}
        className="inline-flex items-center gap-1 text-xs font-medium text-lab-green hover:underline"
      >
        Tüm fotoğraflar + karşılaştırma
        <ChevronRight className="size-3.5" />
      </Link>
    </section>
  );
}
