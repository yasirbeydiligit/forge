"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, CloudOff, Loader2, Play, Timer, X } from "lucide-react";

import { formatNumber, formatRepRange, formatRest } from "@/lib/format";
import { sessionTotals } from "@/lib/session/totals";
import type { ExerciseState } from "@/lib/session/types";
import { cn } from "@/lib/utils";

import type { SessionReport } from "@/lib/reports/session-report";

import { getSessionReportAction } from "./actions";
import { ActiveSetView } from "./active-set-view";
import { OverviewSheet, type OverviewExercise } from "./overview-sheet";
import type { PlayerData } from "./player-data";
import { RestSheet, type RestSheetNext, type RestSheetPr } from "./rest-sheet";
import {
  SessionSummary,
  type SummaryExercise,
  type SummaryExerciseDetail,
} from "./session-summary";
import { useSessionPlayer } from "./use-session-player";

function fmtElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Live session clock; ticks while running, freezes once the session is
 * finished (so "Antrenmanı bitir" stops the timer immediately). */
function useElapsed(startedAt: number | null, stoppedAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt == null || stoppedAt != null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, stoppedAt]);
  if (startedAt == null) return 0;
  if (stoppedAt != null) return stoppedAt - startedAt;
  return now - startedAt;
}

function plannedLine(target: PlayerData["exercises"][number]["target"], category: string | null) {
  const reps = formatRepRange(target.repsMin, target.repsMax);
  const rest = formatRest(target.restSeconds);
  const scheme = [
    target.sets ? `hedef ${target.sets}` : null,
    reps ? `× ${reps}` : null,
    target.weight != null ? `@ ${formatNumber(target.weight)} kg` : null,
  ]
    .filter(Boolean)
    .join(" ");
  return [category, scheme || null, rest].filter(Boolean).join(" · ");
}

function isExerciseDone(ex: ExerciseState, targetSets: number | null): boolean {
  return targetSets != null && targetSets > 0 && ex.sets.length >= targetSets;
}

type ResolvedExercise = {
  name: string;
  category: string | null;
  target: PlayerData["exercises"][number]["target"];
  /** History behind the "Geçen" strip, suggestions and summary deltas. */
  strip: {
    prevSessionSets: { weight: number; reps: number | null }[];
    allTimePr: number | null;
    prevSessionWeights: number[];
  };
  isAdded: boolean;
  isSubstituted: boolean;
};

/**
 * One view of an exercise slot regardless of its origin: program row, muadil
 * swap (program row + substitute overlay) or session-added (state only).
 */
function resolveExercise(
  data: PlayerData,
  ex: ExerciseState | undefined,
  i: number,
): ResolvedExercise | null {
  if (!ex) return null;
  if (ex.added) {
    return {
      name: ex.added.name,
      category: ex.added.category,
      target: ex.added.target,
      strip: ex.added.stats,
      isAdded: true,
      isSubstituted: false,
    };
  }
  const meta = data.exercises[i];
  if (!meta) return null;
  const stats = ex.substitute ? ex.substitute.stats : meta.stats;
  return {
    name: ex.substitute?.name ?? meta.name,
    category: ex.substitute ? (ex.substitute.category ?? meta.category) : meta.category,
    target: meta.target,
    strip: stats,
    isAdded: false,
    isSubstituted: ex.substitute != null,
  };
}

type Player = ReturnType<typeof useSessionPlayer>;

type RestSheetState = { pr: RestSheetPr | null; next: RestSheetNext };

export function SessionPlayer({ data }: { data: PlayerData }) {
  const router = useRouter();
  const player = useSessionPlayer(data);
  const { state } = player;
  const exitTo = `/antrenman/${data.date}`;

  const started = state.startedAt != null;
  const finished = state.finishedAt != null;
  const elapsedMs = useElapsed(state.startedAt, state.finishedAt);
  const timerLabel = started ? fmtElapsed(elapsedMs) : null;

  const [restSheet, setRestSheet] = useState<RestSheetState | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div
        aria-hidden
        className="paper-grain pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
      />

      {/* Top bar: exit · workout label · session clock (mono, green) */}
      <header className="pt-safe relative z-10 flex h-14 shrink-0 items-center justify-between gap-2 px-3">
        <button
          type="button"
          onClick={() => router.push(exitTo)}
          aria-label="Kapat"
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
        >
          <X className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => setOverviewOpen(true)}
          className="min-w-0 truncate font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          {data.workoutName}
        </button>

        <div className="flex w-[4.5rem] items-center justify-end gap-1.5">
          {!player.online ? (
            <CloudOff className="size-4 text-lab-amber" aria-label="Çevrimdışı" />
          ) : player.isSyncing ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Senkronlanıyor" />
          ) : null}
          <span className="font-mono text-sm tabular-nums text-lab-green">
            {timerLabel ?? "—:—"}
          </span>
        </div>
      </header>

      {finished ? (
        <FinishView
          data={data}
          player={player}
          onExit={(note) => {
            player.finish(note);
            router.push(exitTo);
          }}
        />
      ) : (
        <ActiveScreen
          data={data}
          player={player}
          started={started}
          restSheet={restSheet}
          setRestSheet={setRestSheet}
          onOpenOverview={() => setOverviewOpen(true)}
        />
      )}

      {!finished ? (
        <OverviewLayer
          data={data}
          player={player}
          timerLabel={timerLabel}
          open={overviewOpen}
          onClose={() => setOverviewOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Screen 1 host (start gate + one-set screen + rest layer)               */
/* ----------------------------------------------------------------------- */

function ActiveScreen({
  data,
  player,
  started,
  restSheet,
  setRestSheet,
  onOpenOverview,
}: {
  data: PlayerData;
  player: Player;
  started: boolean;
  restSheet: RestSheetState | null;
  setRestSheet: (s: RestSheetState | null) => void;
  onOpenOverview: () => void;
}) {
  const { state } = player;
  const idx = state.activeExerciseIndex;
  const exState = state.exercises[idx];
  const resolved = resolveExercise(data, exState, idx);
  if (!resolved || !exState) return null;

  const isLast = idx === state.exercises.length - 1;
  const restSeconds = resolved.target.restSeconds ?? null;

  // Suggested values: the last set entered this session, else last session's
  // last set (the exercise's OWN history — the substitute's after a muadil
  // swap, the added exercise's after hareket ekle), else the program target.
  const lastThis = exState.sets.at(-1) ?? null;
  const prevLast = resolved.strip.prevSessionSets.at(-1) ?? null;
  const suggestedWeight = lastThis?.weight ?? prevLast?.weight ?? resolved.target.weight ?? null;
  const suggestedReps = lastThis?.reps ?? prevLast?.reps ?? resolved.target.repsMin ?? null;

  const resolvedName = (i: number) =>
    resolveExercise(data, state.exercises[i], i)?.name ?? "Egzersiz";

  const completeSet = (input: {
    weight: number | null;
    reps: number | null;
    rir: number | null;
    note: string | null;
  }) => {
    const result = player.completeSet(idx, input);
    const setsAfter = exState.sets.length + 1;
    const exerciseDone = resolved.target.sets != null && setsAfter >= resolved.target.sets;

    if (player.autoRest && restSeconds && restSeconds > 0) player.startRest(idx, restSeconds);

    const next: RestSheetNext = !exerciseDone
      ? {
          kind: "set",
          setNumber: setsAfter + 1,
          weight: input.weight ?? suggestedWeight,
          reps: input.reps ?? suggestedReps,
        }
      : isLast
        ? { kind: "summary" }
        : { kind: "exercise", name: resolvedName(idx + 1) };

    const pr: RestSheetPr | null = result.isPR && result.type
      ? { type: result.type, weight: input.weight, reps: input.reps }
      : null;

    // The sheet is the rest layer AND the PR / hand-off moment; skip it only
    // when there is nothing to show (no rest, no PR, mid-exercise).
    if ((player.autoRest && restSeconds) || pr || exerciseDone) {
      setRestSheet({ pr, next });
    }
  };

  const advance = () => {
    if (isLast) {
      player.goToSummary();
    } else {
      player.setActiveExercise(idx + 1);
    }
    setRestSheet(null);
  };

  const restActive = state.rest != null && state.rest.endsAt > Date.now();

  return (
    <>
      {/* Exercise progress: one segment per exercise (added ones included) */}
      <div className="relative z-10 flex shrink-0 gap-1 px-4 pb-3" aria-hidden>
        {state.exercises.map((e, i) => (
          <span
            key={e.workoutExerciseId}
            className={cn(
              "h-[3px] flex-1 rounded-full",
              isExerciseDone(e, resolveExercise(data, e, i)?.target.sets ?? null)
                ? "bg-primary"
                : i === idx
                  ? "bg-primary/40"
                  : "bg-border",
            )}
          />
        ))}
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-4">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col lg:max-w-lg lg:justify-center">
          <p className="text-label text-accent-training">
            Egzersiz {idx + 1}/{state.exercises.length}
          </p>

          <button
            type="button"
            onClick={onOpenOverview}
            aria-label="Egzersiz listesini aç"
            className="mt-0.5 flex items-center gap-1.5 text-left"
          >
            <h2 className="min-w-0 truncate font-serif text-[1.75rem] font-normal leading-tight text-lab-ink">
              {resolved.name}
            </h2>
            <ChevronDown className="size-5 shrink-0 text-muted-foreground" />
          </button>

          <p className="mb-3 mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
            {plannedLine(resolved.target, resolved.category)}
            {resolved.isSubstituted ? " · muadil" : resolved.isAdded ? " · eklendi" : ""}
          </p>

          {!started ? (
            <div className="flex flex-1 flex-col justify-end pb-2">
              <p className="mb-3 rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                Hazır olduğunda başlat — hedefler yüklü.
              </p>
              <button
                type="button"
                onClick={player.start}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-raised transition-transform duration-[var(--dur-fast)] ease-soft active:scale-[0.98]"
              >
                <Play className="size-5" /> Antrenmanı başlat
              </button>
            </div>
          ) : (
            <div className="flex flex-1 flex-col justify-end">
              {restActive && !restSheet ? (
                <RestChip
                  endsAt={state.rest!.endsAt}
                  onOpen={() =>
                    setRestSheet({
                      pr: null,
                      next: {
                        kind: "set",
                        setNumber: exState.sets.length + 1,
                        weight: suggestedWeight,
                        reps: suggestedReps,
                      },
                    })
                  }
                />
              ) : null}

              <ActiveSetView
                key={`${idx}-${exState.sets.length}-${exState.exerciseId}`}
                sets={exState.sets}
                targetSets={resolved.target.sets}
                suggestedWeight={suggestedWeight}
                suggestedReps={suggestedReps}
                prevSessionSets={resolved.strip.prevSessionSets}
                allTimePr={resolved.strip.allTimePr}
                onCompleteSet={completeSet}
                onDeleteSet={player.deleteSet}
              />
            </div>
          )}
        </div>
      </div>

      <RestSheet
        open={restSheet != null}
        restEndsAt={state.rest?.endsAt ?? null}
        totalSeconds={
          state.rest != null
            ? (resolveExercise(data, state.exercises[state.rest.exerciseIndex], state.rest.exerciseIndex)
                ?.target.restSeconds ?? 120)
            : 120
        }
        pr={restSheet?.pr ?? null}
        next={restSheet?.next ?? { kind: "set", setNumber: 1, weight: null, reps: null }}
        onExtend={player.extendRest}
        onSkip={() => {
          player.clearRest();
          if (restSheet && restSheet.next.kind !== "set") advance();
          else setRestSheet(null);
        }}
        onClose={() => setRestSheet(null)}
        onAdvance={advance}
        onDone={player.notifyRestDone}
      />
    </>
  );
}

/** Compact countdown chip when the sheet is dismissed but the rest still runs. */
function RestChip({ endsAt, onOpen }: { endsAt: number; onOpen: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, endsAt - now);
  if (remaining === 0) return null;
  const m = Math.floor(remaining / 60000);
  const s = Math.ceil((remaining % 60000) / 1000) % 60;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mb-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-primary/25 bg-primary/5 font-mono text-xs tabular-nums text-primary transition-colors duration-[var(--dur-fast)] ease-soft active:bg-primary/10"
    >
      <Timer className="size-3.5" aria-hidden />
      Dinlenme {m}:{String(s).padStart(2, "0")} — aç
    </button>
  );
}

/* ----------------------------------------------------------------------- */
/*  Screen 3 wiring                                                        */
/* ----------------------------------------------------------------------- */

function OverviewLayer({
  data,
  player,
  timerLabel,
  open,
  onClose,
}: {
  data: PlayerData;
  player: Player;
  timerLabel: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { state } = player;
  const idx = state.activeExerciseIndex;

  const exercises: OverviewExercise[] = state.exercises
    .map((ex, i) => {
      const resolved = resolveExercise(data, ex, i);
      if (!resolved) return null;
      const done = isExerciseDone(ex, resolved.target.sets);
      const active = i === idx;

      let subLine: string;
      if (done) {
        const weights = ex.sets
          .map((s) => s.weight)
          .filter((w): w is number => w != null);
        const range =
          weights.length > 0
            ? [Math.min(...weights), Math.max(...weights)]
                .filter((v, j, a) => a.indexOf(v) === j)
                .map((w) => formatNumber(w))
                .join("–")
            : null;
        subLine = `${ex.sets.length} set${range ? ` · ${range} kg` : ""}`;
      } else if (active) {
        const lastThis = ex.sets.at(-1) ?? null;
        const prevLast = resolved.strip.prevSessionSets.at(-1) ?? null;
        const w = lastThis?.weight ?? prevLast?.weight ?? resolved.target.weight;
        const r = lastThis?.reps ?? prevLast?.reps ?? resolved.target.repsMin;
        subLine = `${ex.sets.length}/${resolved.target.sets ?? "?"} set${
          r != null || w != null
            ? ` · sıradaki: ${r ?? "—"}${w != null ? ` @ ${formatNumber(w)}` : ""}`
            : ""
        }`;
      } else {
        subLine = [
          resolved.target.sets != null
            ? `${resolved.target.sets} × ${formatRepRange(resolved.target.repsMin, resolved.target.repsMax) ?? "—"}`
            : (formatRepRange(resolved.target.repsMin, resolved.target.repsMax) ?? "—"),
          formatRest(resolved.target.restSeconds),
        ]
          .filter(Boolean)
          .join(" · ");
      }
      if (resolved.isSubstituted) subLine += " · muadil";
      if (resolved.isAdded) subLine += " · eklendi";

      return {
        index: i,
        name: resolved.name,
        exerciseId: ex.exerciseId,
        originalExerciseId: ex.substitute ? ex.substitute.originalExerciseId : null,
        done,
        active,
        setsDone: ex.sets.length,
        targetSets: resolved.target.sets,
        subLine,
        canSwap: !done && !active && ex.sets.length === 0 && !resolved.isAdded,
        canRemove: resolved.isAdded && ex.sets.length === 0,
      };
    })
    .filter((e): e is OverviewExercise => e != null);

  const totals = sessionTotals(state.exercises);
  const targetTotal = state.exercises.reduce(
    (sum, ex, i) =>
      sum + (resolveExercise(data, ex, i)?.target.sets ?? ex.sets.length),
    0,
  );

  return (
    <OverviewSheet
      open={open}
      onClose={onClose}
      workoutName={data.workoutName}
      timerLabel={timerLabel}
      date={data.date}
      exercises={exercises}
      setTotals={{ done: totals.setCount, target: targetTotal }}
      autoRest={player.autoRest}
      soundHaptics={player.soundHaptics}
      onAutoRest={player.setAutoRest}
      onSoundHaptics={player.setSoundHaptics}
      onJump={(i) => {
        player.setActiveExercise(i);
        onClose();
      }}
      onSubstitute={player.substituteExercise}
      onAdd={player.addExercise}
      onRemove={player.removeExercise}
      onFinish={() => {
        onClose();
        player.goToSummary();
      }}
    />
  );
}

/* ----------------------------------------------------------------------- */
/*  Finish                                                                 */
/* ----------------------------------------------------------------------- */

function FinishView({
  data,
  player,
  onExit,
}: {
  data: PlayerData;
  player: Player;
  onExit: (note: string) => void;
}) {
  const { state } = player;
  const totals = sessionTotals(state.exercises);
  const durationMs =
    state.startedAt != null ? (state.finishedAt ?? Date.now()) - state.startedAt : 0;

  // Fetch the server-authoritative report once the set queue has drained, so it
  // reflects every synced set. Falls back to the client recap while loading /
  // offline.
  const [report, setReport] = useState<SessionReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const synced = player.pendingCount === 0;
  useEffect(() => {
    if (!synced) return;
    let cancelled = false;
    setReportLoading(true);
    getSessionReportAction({ date: data.date, assignmentId: data.assignmentId })
      .then((res) => {
        if (cancelled) return;
        if ("report" in res) setReport(res.report);
        setReportLoading(false);
      })
      .catch(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [synced, data.date, data.assignmentId]);

  const resolvedName = useCallback(
    (i: number) => resolveExercise(data, state.exercises[i], i)?.name ?? "Egzersiz",
    [state.exercises, data],
  );

  const exercises: SummaryExerciseDetail[] = state.exercises
    .map((ex, i) => {
      const strip = resolveExercise(data, ex, i)?.strip;
      const prevWeights = strip?.prevSessionWeights ?? [];
      const sets = ex.sets.map((s, j) => {
        const prevW = prevWeights[j];
        const deltaVsPrev =
          prevW != null && s.weight != null
            ? Math.round((s.weight - prevW) * 10) / 10
            : null;
        return { weight: s.weight, reps: s.reps, pr: s.pr, deltaVsPrev };
      });
      const prevSetCount = strip ? strip.prevSessionSets.length : null;
      return { name: resolvedName(i), sets, setCount: sets.length, prevSetCount };
    })
    .filter((e) => e.sets.length > 0);

  const totalReps = state.exercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((a, s) => a + (s.reps ?? 0), 0),
    0,
  );

  const prExercises: SummaryExercise[] = state.exercises
    .map((ex, i) => ({
      name: resolvedName(i),
      prSets: ex.sets.filter((s) => s.pr).map((s) => ({ weight: s.weight, reps: s.reps })),
    }))
    .filter((e) => e.prSets.length > 0);

  return (
    <div className="relative z-10 flex-1 overflow-y-auto">
      <SessionSummary
        workoutName={data.workoutName}
        durationMs={durationMs}
        setCount={totals.setCount}
        totalReps={totalReps}
        prCount={totals.prCount}
        prExercises={prExercises}
        exercises={exercises}
        report={report}
        reportLoading={reportLoading}
        insights={data.insights}
        initialNote={data.initialNote}
        onExit={onExit}
        onReopen={player.reopen}
      />
    </div>
  );
}
