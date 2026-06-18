import type { Metadata } from "next";

import { CoachCalendar, type CalendarAssignmentView } from "./coach-calendar";
import { PageHeader } from "@/components/shell/page-header";
import { requireCoach } from "@/lib/auth";
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

export default async function CoachCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireCoach();
  const { month: monthParam } = await searchParams;
  const month = parseMonthKey(monthParam);

  // Range covering the visible 6-week grid.
  const weeks = buildMonthMatrix(month);
  const rangeStart = toDateKey(weeks[0][0]);
  const rangeEnd = toDateKey(weeks[weeks.length - 1][6]);

  const supabase = await createSupabaseServerClient();
  const [{ data: assignmentsData }, { data: programsData }, { data: athletesData }] =
    await Promise.all([
      supabase
        .from("calendar_assignments")
        .select(
          "id, scheduled_date, athlete_id, program:programs(name), workout:workouts(name), athlete:profiles!calendar_assignments_athlete_id_profiles_id_fk(full_name)",
        )
        .gte("scheduled_date", rangeStart)
        .lte("scheduled_date", rangeEnd),
      supabase
        .from("programs")
        .select("id, name, workouts(id, name, order_index)")
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "athlete")
        .order("full_name", { ascending: true }),
    ]);

  const assignments = (assignmentsData ?? []) as unknown as CalendarAssignmentView[];
  const programs = (programsData ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    workouts: [...(p.workouts ?? [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((w) => ({ id: w.id, name: w.name })),
  }));
  const athletes = athletesData ?? [];

  return (
    <div>
      <PageHeader
        title="Takvim"
        description="Antrenmanları günlere ata; sporcuların takviminde otomatik görünür."
      />
      <CoachCalendar
        monthKey={monthKeyOf(month)}
        monthLabel={monthLabel(month)}
        prevKey={prevMonthKey(month)}
        nextKey={nextMonthKey(month)}
        assignments={assignments}
        programs={programs}
        athletes={athletes}
      />
    </div>
  );
}
