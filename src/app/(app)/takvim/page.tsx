import type { Metadata } from "next";

import { AthleteCalendar, type AthleteAssignmentView } from "./athlete-calendar";
import { PageHeader } from "@/components/shell/page-header";
import { requireProfile } from "@/lib/auth";
import {
  buildMonthMatrix,
  monthKeyOf,
  monthLabel,
  nextMonthKey,
  parseMonthKey,
  prevMonthKey,
} from "@/lib/calendar";
import { toDateKey } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Takvim" };

export default async function AthleteCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const profile = await requireProfile();
  const { month: monthParam } = await searchParams;
  const month = parseMonthKey(monthParam);

  const weeks = buildMonthMatrix(month);
  const rangeStart = toDateKey(weeks[0][0]);
  const rangeEnd = toDateKey(weeks[weeks.length - 1][6]);

  const supabase = await createSupabaseServerClient();
  const [{ data: assignmentsData }, { data: sessionsData }] = await Promise.all([
    supabase
      .from("calendar_assignments")
      .select("id, scheduled_date, workout:workouts(name)")
      .gte("scheduled_date", rangeStart)
      .lte("scheduled_date", rangeEnd)
      .order("scheduled_date", { ascending: true }),
    supabase
      .from("log_sessions")
      .select("session_date, completed")
      .eq("athlete_id", profile.id)
      .eq("completed", true)
      .gte("session_date", rangeStart)
      .lte("session_date", rangeEnd),
  ]);

  const assignments = (assignmentsData ?? []) as unknown as AthleteAssignmentView[];
  const completedDates = (sessionsData ?? []).map((s) => s.session_date);

  return (
    <div>
      <PageHeader
        title="Takvimim"
        description="Bir güne dokun, o günün antrenmanını aç ve işle."
      />
      <AthleteCalendar
        monthKey={monthKeyOf(month)}
        monthLabel={monthLabel(month)}
        prevKey={prevMonthKey(month)}
        nextKey={nextMonthKey(month)}
        assignments={assignments}
        completedDates={completedDates}
      />
    </div>
  );
}
