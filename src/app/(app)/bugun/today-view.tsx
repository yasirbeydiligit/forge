import Link from "next/link";
import {
  Activity,
  Camera,
  ClipboardList,
  Dumbbell,
  Footprints,
  type LucideIcon,
  Play,
  Scale,
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
import { MeasureCard } from "@/components/measure-card";
import { MacroBar } from "@/components/nutrition/macro-bar";
import { AnimatedNumber } from "@/components/today/animated-number";
import { HydrationBottle } from "@/components/today/hydration-bottle";
import { RevealStagger } from "@/components/today/reveal-stagger";
import { WeekStrip } from "@/components/today/week-strip";
import {
  ProtocolChecklist,
  type ProtocolItem,
} from "@/app/(app)/beslenme/protocol-checklist";
import { CARDIO_LABEL_TR, formatDuration, type CardioActivityKey } from "@/lib/cardio";
import type { AthleteInsight } from "@/lib/rag/insights-server";
import type { WeekDayCell } from "@/lib/today/week-strip";

/** Everything the Today page shows, already digested — no data access here. */
export type TodayViewProps = {
  firstName: string;
  todayKey: string;
  dateLabel: string;
  weekNo: number;
  weekStripCells: WeekDayCell[];
  workout: {
    name: string;
    exercises: { name: string; line: string }[];
    moreCount: number;
    assignmentId: string;
    done: boolean;
  } | null;
  nutrition: {
    has: boolean;
    kcal: number;
    targetKcal: number | null;
    protein: number;
    carbs: number;
    fat: number;
    targetProtein: number | null;
    targetCarbs: number | null;
    targetFat: number | null;
  };
  insights: AthleteInsight[];
  steps: { today: number | null; series: number[] };
  weight: { latest: number | null; delta: number | null; series: number[] };
  hydration: { current: number; target: number | null };
  cardio: { totalMin: number; count: number; topActivity: CardioActivityKey | null };
  physique: {
    url: string | null;
    hasPhoto: boolean;
    ageDays: number | null;
    stale: boolean;
  };
  protocols: ProtocolItem[];
  week: { completed: number; target: number | null; programCount: number };
};

export function TodayView(props: TodayViewProps) {
  const {
    firstName,
    todayKey,
    dateLabel,
    weekNo,
    weekStripCells,
    workout,
    nutrition: n,
    insights,
    steps,
    weight,
    hydration,
    cardio,
    physique,
    protocols,
    week,
  } = props;

  return (
    <LabPage>
      <LabHeader
        metaLeft={dateLabel}
        metaRight={`Hafta ${weekNo}`}
        title="Bugün"
        subtitle={
          workout
            ? `${firstName} · ${workout.name}`
            : `${firstName} · bugün planlı antrenman yok`
        }
      />

      <RevealStagger className="space-y-8">
        {/* 1 — Week strip */}
        <section>
          <WeekStrip cells={weekStripCells} />
        </section>

        {/* 2 — Today's workout, smart entry */}
        <section className="space-y-3">
          <SectionLabel>Bugünün antrenmanı</SectionLabel>
          {workout ? (
            <WorkoutEntry workout={workout} todayKey={todayKey} />
          ) : (
            <PaperCard className="p-5">
              <p className="font-serif text-lg italic text-paper-muted">
                Dinlenme günü olabilir 💪
              </p>
              <p className="mt-2 text-sm text-paper-muted">
                Kendi programından bir antrenman seç ya da takvimine göz at.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/programlar"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform duration-[var(--dur-fast)] ease-soft active:scale-[0.98]"
                >
                  <Dumbbell className="size-4" />
                  Antrenman seç
                </Link>
                <LabLink href="/takvim">Takvim →</LabLink>
              </div>
            </PaperCard>
          )}
        </section>

        {/* 3 — Nutrition (calories + macros) */}
        <section className="space-y-3">
          <SectionLabel>Beslenme</SectionLabel>
          <Link href="/beslenme" className="block">
            <PaperCard className="p-5 transition-shadow hover:shadow-md">
              {n.has ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <p className="font-serif text-2xl tabular-nums text-paper-foreground">
                      <AnimatedNumber value={n.kcal} />
                      {n.targetKcal ? (
                        <span className="text-lg text-paper-muted">
                          {" "}
                          / {n.targetKcal.toLocaleString("tr-TR")}
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
                      value={n.protein}
                      target={n.targetProtein}
                      accent="green"
                    />
                    <MacroBar
                      label="Karbonhidrat"
                      value={n.carbs}
                      target={n.targetCarbs}
                      accent="amber"
                    />
                    <MacroBar
                      label="Yağ"
                      value={n.fat}
                      target={n.targetFat}
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

        {/* 4 — Hydration object */}
        <section className="space-y-3">
          <SectionLabel>Hidrasyon</SectionLabel>
          <HydrationBottle
            date={todayKey}
            current={hydration.current}
            target={hydration.target}
          />
        </section>

        {/* 5 — Summary boxes: steps / weight / cardio / physique */}
        <section className="space-y-3">
          <SectionLabel>Bugünün özeti</SectionLabel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {steps.today != null ? (
              <MeasureCard
                label="Adım"
                value={<AnimatedNumber value={steps.today} />}
                icon={Footprints}
                accent="blue"
                points={steps.series.length > 1 ? steps.series : undefined}
              />
            ) : (
              <AddBox
                href="/takip"
                icon={Footprints}
                label="Adım"
                cta="Bugünkü adımını gir"
              />
            )}

            {weight.latest != null ? (
              <MeasureCard
                label="Kilo"
                value={
                  <AnimatedNumber
                    value={weight.latest}
                    decimals={1}
                    grouped={false}
                  />
                }
                unit="kg"
                icon={Scale}
                accent="green"
                points={weight.series.length > 1 ? weight.series : undefined}
                hint={
                  weight.delta != null
                    ? `${weight.delta > 0 ? "+" : ""}${weight.delta.toFixed(1)} kg son ölçüme göre`
                    : undefined
                }
              />
            ) : (
              <AddBox href="/takip" icon={Scale} label="Kilo" cta="Kilonu gir" />
            )}

            {cardio.totalMin > 0 ? (
              <MeasureCard
                label="Kardiyo"
                value={formatDuration(cardio.totalMin)}
                icon={Activity}
                accent="blue"
                hint={
                  cardio.count > 0
                    ? `${cardio.count} aktivite${
                        cardio.topActivity
                          ? ` · ${CARDIO_LABEL_TR[cardio.topActivity].toLowerCase()}`
                          : ""
                      }`
                    : undefined
                }
              />
            ) : (
              <AddBox
                href="/takip"
                icon={Activity}
                label="Kardiyo"
                cta="Kardiyo ekle"
              />
            )}

            <Link href="/fizik" className="block">
              <PaperCard className="flex h-full flex-row items-center gap-3 p-4 transition-shadow hover:shadow-md">
                {physique.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={physique.url}
                    alt="Son fizik fotoğrafı"
                    className="size-12 shrink-0 rounded-lg border border-paper-border object-cover"
                  />
                ) : (
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-paper-foreground/[0.06] text-lab-green">
                    <Camera className="size-5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-label text-paper-muted">Fizik</span>
                  <p className="mt-0.5 text-xs text-paper-muted">
                    {!physique.hasPhoto
                      ? "İlk fotoğrafını ekle."
                      : physique.stale
                        ? "Güncelleme zamanı."
                        : physique.ageDays === 0
                          ? "Bugün eklendi."
                          : `${physique.ageDays} gün önce.`}
                  </p>
                </div>
              </PaperCard>
            </Link>
          </div>
        </section>

        {/* 6 — Protocols (only when assigned) */}
        {protocols.length > 0 ? (
          <section className="space-y-3">
            <SectionLabel>Protokoller</SectionLabel>
            <ProtocolChecklist date={todayKey} protocols={protocols} />
          </section>
        ) : null}

        {/* 7 — This week at a glance */}
        <section className="space-y-3">
          <SectionLabel>Bu hafta</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <PaperCard className="p-4">
              <SectionLabel className="text-paper-muted">
                Tamamlanan seans
              </SectionLabel>
              <p className="mt-1 font-serif text-3xl tabular-nums text-paper-foreground">
                <AnimatedNumber value={week.completed} />
                {week.target ? (
                  <span className="text-xl text-paper-muted"> / {week.target}</span>
                ) : null}
              </p>
              {week.target && week.completed >= week.target ? (
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
                <AnimatedNumber value={week.programCount} />
              </p>
            </PaperCard>
          </div>
        </section>

        {/* 8 — Quick access */}
        <section className="space-y-3">
          <SectionLabel>Hızlı erişim</SectionLabel>
          <div className="grid grid-cols-2 gap-3">
            <QuickTile href="/takip" icon={ClipboardList} label="Günlük takip" />
            <QuickTile href="/programlar" icon={Dumbbell} label="Programlar" />
          </div>
        </section>

        {/* 9 — Editorial margin note */}
        <section>
          <MarginNote
            label="Not · Süreklilik"
            accent="green"
            footer={<LabLink href="/ilerleme">İlerlemeni gör →</LabLink>}
          >
            {week.completed > 0
              ? `Bu hafta ${week.completed} seans tamamladın. İstikrar, ilerlemenin temelidir — küçük ve düzenli adımlar uzun vadede en çok farkı yaratır.`
              : "Bu haftanın ilk seansını tamamlayarak ivmeyi başlat. Küçük ve düzenli adımlar uzun vadede en çok farkı yaratır."}
          </MarginNote>
        </section>
      </RevealStagger>
    </LabPage>
  );
}

/** Today's planned workout with a prominent start (or a done → summary) CTA. */
function WorkoutEntry({
  workout,
  todayKey,
}: {
  workout: NonNullable<TodayViewProps["workout"]>;
  todayKey: string;
}) {
  return (
    <PaperCard className="p-5">
      <div className="flex items-center justify-between">
        <SectionLabel className="text-paper-muted">Antrenman</SectionLabel>
        {workout.done ? (
          <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-lab-green">
            Tamamlandı ✓
          </span>
        ) : null}
      </div>
      <h3 className="mt-1 font-serif text-2xl text-paper-foreground">
        {workout.name}
      </h3>

      {workout.exercises.length ? (
        <ul className="mt-3 divide-y divide-paper-border border-t border-paper-border">
          {workout.exercises.map((e, i) => (
            <li
              key={i}
              className="flex items-baseline justify-between gap-4 py-2 text-sm"
            >
              <span className="text-paper-foreground">{e.name}</span>
              <span className="shrink-0 font-mono text-[13px] tabular-nums text-paper-muted">
                {e.line}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        {workout.moreCount > 0 ? (
          <span className="text-xs text-paper-muted">
            +{workout.moreCount} egzersiz daha
          </span>
        ) : (
          <span />
        )}
        {workout.done ? (
          <Link
            href={`/antrenman/${todayKey}`}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-paper-border px-5 text-sm font-medium text-paper-foreground transition-colors duration-[var(--dur-fast)] hover:bg-surface"
          >
            Özeti gör →
          </Link>
        ) : (
          <Link
            href={`/antrenman/${todayKey}/seans?a=${workout.assignmentId}`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform duration-[var(--dur-fast)] ease-soft active:scale-[0.98]"
          >
            <Play className="size-4" />
            Antrenmanı başlat
          </Link>
        )}
      </div>
    </PaperCard>
  );
}

/** Empty-state summary box: a gentle "add" invitation in the Forge voice. */
function AddBox({
  href,
  icon: Icon,
  label,
  cta,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  cta: string;
}) {
  return (
    <Link href={href} className="block">
      <PaperCard className="flex h-full flex-col justify-between p-4 transition-shadow hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="text-label text-paper-muted">{label}</span>
          <Icon className="size-4 shrink-0 text-paper-muted" />
        </div>
        <p className="mt-2 text-sm text-lab-link">{cta} →</p>
      </PaperCard>
    </Link>
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
