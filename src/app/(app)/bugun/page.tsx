import type { Metadata } from "next";
import Link from "next/link";
import { endOfWeek, getISOWeek, startOfWeek } from "date-fns";
import {
  Camera,
  ClipboardList,
  Dumbbell,
  type LucideIcon,
  UtensilsCrossed,
} from "lucide-react";

import {
  LabHeader,
  LabLink,
  LabPage,
  MarginNote,
  PaperCard,
  SectionLabel,
} from "@/components/lab/lab";
import { InsightNotes } from "@/components/library/insight-note";
import { MacroBar } from "@/components/nutrition/macro-bar";
import { requireProfile } from "@/lib/auth";
import { formatDate, formatNumber, formatRepRange, toDateKey } from "@/lib/format";
import { STALE_AFTER_DAYS, daysSince, signPhysiquePaths } from "@/lib/physique";
import { getAthleteInsights } from "@/lib/rag/insights-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Meal, NutritionTarget } from "@/lib/types";

export const metadata: Metadata = { title: "Bugün" };

type TodayExercise = {
  order_index: number;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight: number | null;
  exercise: { name: string } | null;
};
type TodayAssignment = {
  id: string;
  workout: { name: string; workout_exercises: TodayExercise[] } | null;
};

function plannedLine(e: TodayExercise): string {
  const reps = formatRepRange(e.target_reps_min, e.target_reps_max);
  const base =
    e.target_sets && reps
      ? `${e.target_sets} × ${reps}`
      : e.target_sets
        ? `${e.target_sets} set`
        : reps
          ? `${reps} tekrar`
          : "—";
  return e.target_weight ? `${base} @ ${formatNumber(e.target_weight)}` : base;
}

export default async function TodayPage() {
  const profile = await requireProfile();
  const today = new Date();
  const todayKey = toDateKey(today);
  const weekStart = toDateKey(startOfWeek(today, { weekStartsOn: 1 }));
  const weekEnd = toDateKey(endOfWeek(today, { weekStartsOn: 1 }));

  const supabase = await createSupabaseServerClient();
  const [
    { data: assignmentsData },
    { data: todaySessions },
    { count: weekCount },
    { count: programCount },
    { data: targetData },
    { data: mealsData },
    { data: details },
    { data: lastPhotoData },
  ] = await Promise.all([
    supabase
      .from("calendar_assignments")
      .select(
        "id, workout:workouts(name, workout_exercises(order_index, target_sets, target_reps_min, target_reps_max, target_weight, exercise:exercises(name)))",
      )
      .eq("scheduled_date", todayKey),
    supabase
      .from("log_sessions")
      .select("assignment_id, completed")
      .eq("athlete_id", profile.id)
      .eq("session_date", todayKey),
    supabase
      .from("log_sessions")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", profile.id)
      .eq("completed", true)
      .gte("session_date", weekStart)
      .lte("session_date", weekEnd),
    supabase
      .from("enrollments")
      .select("id", { count: "exact", head: true })
      .eq("athlete_id", profile.id),
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("athlete_id", profile.id)
      .maybeSingle(),
    supabase
      .from("meals")
      .select("kcal, protein, carbs, fat")
      .eq("athlete_id", profile.id)
      .eq("meal_date", todayKey),
    supabase
      .from("profile_details")
      .select("weekly_target_days")
      .eq("user_id", profile.id)
      .maybeSingle(),
    supabase
      .from("physique_photos")
      .select("photo_date, storage_path")
      .eq("athlete_id", profile.id)
      .order("photo_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Physique nudge state: latest photo (signed thumb) + how stale it is.
  const lastPhoto = lastPhotoData as
    | { photo_date: string; storage_path: string }
    | null;
  const photoUrls = lastPhoto
    ? await signPhysiquePaths(supabase, [lastPhoto.storage_path])
    : null;
  const lastPhotoUrl = lastPhoto
    ? (photoUrls?.get(lastPhoto.storage_path) ?? null)
    : null;
  const photoAgeDays = lastPhoto ? daysSince(lastPhoto.photo_date) : null;
  const photoStale = photoAgeDays != null && photoAgeDays > STALE_AFTER_DAYS;
  const weeklyTarget = details?.weekly_target_days ?? null;

  const target = targetData as NutritionTarget | null;
  const meals = (mealsData ?? []) as Pick<
    Meal,
    "kcal" | "protein" | "carbs" | "fat"
  >[];
  const nut = {
    kcal: meals.reduce((a, m) => a + (m.kcal ?? 0), 0),
    protein: meals.reduce((a, m) => a + (m.protein ?? 0), 0),
    carbs: meals.reduce((a, m) => a + (m.carbs ?? 0), 0),
    fat: meals.reduce((a, m) => a + (m.fat ?? 0), 0),
  };
  const hasNutrition = meals.length > 0 || target != null;

  const insights = await getAthleteInsights(supabase, profile.id, "nutrition");

  const assignments = (assignmentsData ?? []) as unknown as TodayAssignment[];
  for (const a of assignments) {
    a.workout?.workout_exercises?.sort((x, y) => x.order_index - y.order_index);
  }
  const completedAssignmentIds = new Set(
    (todaySessions ?? [])
      .filter((s) => s.completed && s.assignment_id)
      .map((s) => s.assignment_id as string),
  );

  const firstName = profile.full_name.split(" ")[0];
  const workoutNames = assignments
    .map((a) => a.workout?.name)
    .filter(Boolean)
    .join(" · ");

  return (
    <LabPage>
      <LabHeader
        metaLeft={formatDate(todayKey, "EEEE, d MMMM")}
        metaRight={`Hafta ${getISOWeek(today)}`}
        title="Bugün"
        subtitle={
          assignments.length
            ? `${firstName} · ${workoutNames}`
            : "Bugün için planlı antrenman yok"
        }
      />

      <section className="space-y-3">
        <SectionLabel>Bugünün antrenmanı</SectionLabel>

        {assignments.length === 0 ? (
          <PaperCard className="p-5">
            <p className="font-serif text-lg italic text-paper-muted">
              Dinlenme günü olabilir 💪
            </p>
            <p className="mt-2 text-sm text-paper-muted">
              Takvimine göz at ya da bir programa kaydol.
            </p>
            <div className="mt-3 flex gap-4">
              <LabLink href="/takvim">Takvim →</LabLink>
              <LabLink href="/programlar">Programlar →</LabLink>
            </div>
          </PaperCard>
        ) : (
          assignments.map((a) => {
            const workout = a.workout;
            if (!workout) return null;
            const isDone = completedAssignmentIds.has(a.id);
            const items = workout.workout_exercises ?? [];
            const preview = items.slice(0, 5);
            const more = items.length - preview.length;
            return (
              <Link key={a.id} href={`/antrenman/${todayKey}`} className="block">
                <PaperCard className="p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between">
                    <SectionLabel className="text-paper-muted">
                      Antrenman
                    </SectionLabel>
                    {isDone ? (
                      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-lab-green">
                        Tamamlandı
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-1 font-serif text-2xl text-paper-foreground">
                    {workout.name}
                  </h3>

                  {preview.length ? (
                    <ul className="mt-3 divide-y divide-paper-border border-t border-paper-border">
                      {preview.map((e, i) => (
                        <li
                          key={i}
                          className="flex items-baseline justify-between gap-4 py-2 text-sm"
                        >
                          <span className="text-paper-foreground">
                            {e.exercise?.name ?? "Egzersiz"}
                          </span>
                          <span className="shrink-0 font-mono text-[13px] tabular-nums text-paper-muted">
                            {plannedLine(e)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-4 flex items-center justify-between">
                    {more > 0 ? (
                      <span className="text-xs text-paper-muted">
                        +{more} egzersiz daha
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-sm font-medium text-lab-link">
                      Antrenmanı aç →
                    </span>
                  </div>
                </PaperCard>
              </Link>
            );
          })
        )}
      </section>

      <section className="mt-8 space-y-3">
        <SectionLabel>Beslenme</SectionLabel>
        <Link href="/beslenme" className="block">
          <PaperCard className="p-5 transition-shadow hover:shadow-md">
            {hasNutrition ? (
              <>
                <div className="flex items-baseline justify-between">
                  <p className="font-serif text-2xl tabular-nums text-paper-foreground">
                    {nut.kcal.toLocaleString("tr-TR")}
                    {target?.kcal ? (
                      <span className="text-lg text-paper-muted">
                        {" "}
                        / {target.kcal.toLocaleString("tr-TR")}
                      </span>
                    ) : null}
                    <span className="ml-1 text-sm font-normal text-paper-muted">
                      kcal
                    </span>
                  </p>
                  <span className="text-sm font-medium text-lab-link">Aç →</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <MacroBar
                    label="Protein"
                    value={nut.protein}
                    target={target?.protein ?? null}
                    accent="green"
                  />
                  <MacroBar
                    label="Karbonhidrat"
                    value={nut.carbs}
                    target={target?.carbs ?? null}
                    accent="amber"
                  />
                  <MacroBar
                    label="Yağ"
                    value={nut.fat}
                    target={target?.fat ?? null}
                    accent="violet"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-paper-muted">
                  <UtensilsCrossed className="size-5" />
                  <span className="text-sm">
                    Bugünün öğünlerini ekle ve makrolarını takip et.
                  </span>
                </span>
                <span className="text-sm font-medium text-lab-link">Aç →</span>
              </div>
            )}
          </PaperCard>
        </Link>
        <InsightNotes insights={insights} className="space-y-3" />
      </section>

      <section className="mt-8 space-y-3">
        <SectionLabel>Bu hafta</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <PaperCard className="p-4">
            <SectionLabel className="text-paper-muted">
              Tamamlanan seans
            </SectionLabel>
            <p className="mt-1 font-serif text-3xl tabular-nums text-paper-foreground">
              {weekCount ?? 0}
              {weeklyTarget ? (
                <span className="text-xl text-paper-muted"> / {weeklyTarget}</span>
              ) : null}
            </p>
            {weeklyTarget && (weekCount ?? 0) >= weeklyTarget ? (
              <p className="mt-1 text-xs font-medium text-lab-green">
                Haftalık hedef tamam ✓
              </p>
            ) : null}
          </PaperCard>
          <PaperCard className="p-4">
            <SectionLabel className="text-paper-muted">
              Kayıtlı program
            </SectionLabel>
            <p className="mt-1 font-serif text-3xl tabular-nums text-paper-foreground">
              {programCount ?? 0}
            </p>
          </PaperCard>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <SectionLabel>Fizik</SectionLabel>
        <Link href="/fizik" className="block">
          <PaperCard className="flex flex-row items-center gap-3 p-4 transition-shadow hover:shadow-md">
            {lastPhotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={lastPhotoUrl}
                alt="Son fizik fotoğrafı"
                className="size-14 shrink-0 rounded-lg border border-paper-border object-cover"
              />
            ) : (
              <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-paper-foreground/[0.06] text-lab-green">
                <Camera className="size-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-paper-foreground">
                Fizik güncellemesi
              </p>
              <p className="mt-0.5 text-xs text-paper-muted">
                {lastPhoto == null
                  ? "İlk fotoğrafını ekle — değişim buradan izlenecek."
                  : photoAgeDays === 0
                    ? "Son fotoğraf bugün eklendi."
                    : `Son fotoğraf ${photoAgeDays} gün önce.`}
              </p>
              {photoStale ? (
                <p className="mt-0.5 text-xs font-medium text-lab-amber">
                  Güncelleme zamanı — aynı poz, aynı ışık.
                </p>
              ) : null}
            </div>
            <span className="shrink-0 text-sm font-medium text-lab-link">
              Aç →
            </span>
          </PaperCard>
        </Link>
      </section>

      <section className="mt-8 space-y-3">
        <SectionLabel>Hızlı erişim</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <QuickTile href="/takip" icon={ClipboardList} label="Günlük takip" />
          <QuickTile href="/programlar" icon={Dumbbell} label="Programlar" />
        </div>
      </section>

      <section className="mt-8">
        <MarginNote
          label="Not · Süreklilik"
          accent="green"
          footer={<LabLink href="/ilerleme">İlerlemeni gör →</LabLink>}
        >
          {weekCount && weekCount > 0
            ? `Bu hafta ${weekCount} seans tamamladın. İstikrar, ilerlemenin temelidir — küçük ve düzenli adımlar uzun vadede en çok farkı yaratır.`
            : "Bu haftanın ilk seansını tamamlayarak ivmeyi başlat. Küçük ve düzenli adımlar uzun vadede en çok farkı yaratır."}
        </MarginNote>
      </section>
    </LabPage>
  );
}

function QuickTile({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Link href={href} className="block">
      <PaperCard className="flex flex-row items-center gap-3 p-4 transition-shadow hover:shadow-md">
        <span className="flex size-9 items-center justify-center rounded-lg bg-paper-foreground/[0.06] text-lab-green">
          <Icon className="size-[18px]" />
        </span>
        <span className="text-sm font-medium text-paper-foreground">{label}</span>
      </PaperCard>
    </Link>
  );
}
