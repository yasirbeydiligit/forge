"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CloudOff,
  Flag,
  Loader2,
  Play,
  Timer,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { formatNumber, formatRepRange, formatRest } from "@/lib/format";
import { sessionTotals } from "@/lib/session/totals";
import { cn } from "@/lib/utils";

import { ExerciseHistory } from "./exercise-history";
import type { PlayerData } from "./player-data";
import { RestTimer } from "./rest-timer";
import { SessionSummary, type SummaryExercise } from "./session-summary";
import { SetInput } from "./set-input";
import { useSessionPlayer } from "./use-session-player";

function fmtElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Subtle, always-running session clock. */
function Elapsed({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      {fmtElapsed(now - startedAt)}
    </span>
  );
}

function plannedLine(target: PlayerData["exercises"][number]["target"], category: string | null) {
  const reps = formatRepRange(target.repsMin, target.repsMax);
  const rest = formatRest(target.restSeconds);
  return [
    category,
    target.sets ? `${target.sets} ×` : null,
    reps ?? null,
    target.weight != null ? `@ ${formatNumber(target.weight)} kg` : null,
    target.rpe != null ? `RPE ${formatNumber(target.rpe)}` : null,
    rest,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function SessionPlayer({ data }: { data: PlayerData }) {
  const router = useRouter();
  const player = useSessionPlayer(data);
  const { state } = player;
  const exitTo = `/antrenman/${data.date}`;

  const started = state.startedAt != null;
  const finished = state.finishedAt != null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div
        aria-hidden
        className="paper-grain pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
      />

      {/* Top bar */}
      <header className="pt-safe relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <button
          type="button"
          onClick={() => router.push(exitTo)}
          aria-label="Kapat"
          className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
        >
          <X className="size-5" />
        </button>

        <div className="flex items-center gap-2">
          {started ? <Elapsed startedAt={state.startedAt!} /> : null}
          {!player.online ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-lab-amber" title="Çevrimdışı — girişler kaydedilip bağlantı gelince senkronlanacak">
              <CloudOff className="size-3.5" /> çevrimdışı
            </span>
          ) : player.isSyncing ? (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => player.setSoundHaptics(!player.soundHaptics)}
            aria-label={player.soundHaptics ? "Sesi kapat" : "Sesi aç"}
            aria-pressed={player.soundHaptics}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
          >
            {player.soundHaptics ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
          {started && !finished ? (
            <button
              type="button"
              onClick={player.goToSummary}
              className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
            >
              <Flag className="size-4" /> Bitir
            </button>
          ) : null}
        </div>
      </header>

      {finished ? (
        <FinishView data={data} player={player} onExit={(note) => {
          player.finish(note);
          router.push(exitTo);
        }} />
      ) : !started ? (
        <StartView data={data} onStart={player.start} />
      ) : (
        <ActiveView data={data} player={player} />
      )}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Start                                                                  */
/* ----------------------------------------------------------------------- */

function StartView({ data, onStart }: { data: PlayerData; onStart: () => void }) {
  return (
    <div className="relative z-10 flex flex-1 flex-col overflow-y-auto px-5 py-8">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col">
        <div className="flex-1">
          <p className="text-label text-accent-training">Bugünün antrenmanı</p>
          <h1 className="text-display mt-1 text-lab-ink">{data.workoutName}</h1>
          <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
            {data.exercises.length} egzersiz
          </p>

          <ol className="mt-6 space-y-px overflow-hidden rounded-xl border border-paper-border">
            {data.exercises.map((e, i) => (
              <li key={e.workoutExerciseId} className="flex items-baseline gap-3 bg-paper px-4 py-3">
                <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div className="min-w-0">
                  <p className="font-serif text-base text-paper-foreground">{e.name}</p>
                  <p className="font-mono text-[11px] tabular-nums text-paper-muted">
                    {plannedLine(e.target, e.category)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="pb-safe mx-auto w-full max-w-md pt-6">
        <button
          type="button"
          onClick={onStart}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-raised transition-transform duration-[var(--dur-fast)] ease-soft active:scale-[0.98]"
        >
          <Play className="size-5" /> Antrenmanı başlat
        </button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Active                                                                 */
/* ----------------------------------------------------------------------- */

type Player = ReturnType<typeof useSessionPlayer>;

function ActiveView({ data, player }: { data: PlayerData; player: Player }) {
  const { state } = player;
  const idx = state.activeExerciseIndex;
  const meta = data.exercises[idx];
  const exState = state.exercises[idx];
  if (!meta || !exState) return null;

  const isLast = idx === data.exercises.length - 1;
  const upcoming = exState.sets.length;
  const suggestedWeight = meta.target.weight ?? meta.stats.prevSessionWeights[upcoming] ?? null;
  const suggestedReps = meta.target.repsMin ?? null;
  const restSeconds = meta.target.restSeconds ?? null;

  return (
    <>
      {/* Exercise rail */}
      <nav className="no-scrollbar relative z-10 flex shrink-0 gap-2 overflow-x-auto border-b border-border px-3 py-2">
        {data.exercises.map((e, i) => {
          const done = state.exercises[i].sets.length;
          const targetSets = e.target.sets ?? 0;
          const complete = targetSets > 0 && done >= targetSets;
          const active = i === idx;
          return (
            <button
              key={e.workoutExerciseId}
              type="button"
              onClick={() => player.setActiveExercise(i)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors duration-[var(--dur-fast)] ease-soft",
                active
                  ? "border-primary/40 bg-primary/10 font-medium text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {complete ? (
                <Check className="size-3.5 text-lab-green" />
              ) : (
                <span className="font-mono text-[11px]">{i + 1}</span>
              )}
              <span className="max-w-[8rem] truncate">{e.name}</span>
            </button>
          );
        })}
      </nav>

      {/* Scroll body */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto w-full max-w-md space-y-4">
          <div>
            <p className="text-label text-accent-training">
              Egzersiz {idx + 1}/{data.exercises.length}
            </p>
            <h2 className="mt-1 font-serif text-2xl leading-tight text-lab-ink">{meta.name}</h2>
            <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
              {plannedLine(meta.target, meta.category)}
            </p>
            {meta.notes ? (
              <p className="mt-1.5 text-xs italic text-muted-foreground">{meta.notes}</p>
            ) : null}
          </div>

          <LoggedSets meta={meta} sets={exState.sets} onDelete={player.deleteSet} />

          <ExerciseHistory stats={meta.stats} />
        </div>
      </div>

      {/* Footer thumb zone */}
      <div className="pb-safe relative z-10 shrink-0 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur">
        <div className="mx-auto w-full max-w-md space-y-3">
          {state.rest ? (
            <RestTimer
              endsAt={state.rest.endsAt}
              totalSeconds={data.exercises[state.rest.exerciseIndex]?.target.restSeconds ?? 120}
              onDone={player.notifyRestDone}
              onSkip={player.clearRest}
              onExtend={player.extendRest}
            />
          ) : null}

          <SetInput
            key={`${idx}-${exState.sets.length}`}
            setNumber={upcoming + 1}
            suggestedWeight={suggestedWeight}
            suggestedReps={suggestedReps}
            targetRpe={meta.target.rpe}
            onComplete={(input) => {
              const pr = player.completeSet(idx, input);
              if (restSeconds && restSeconds > 0) player.startRest(idx, restSeconds);
              return pr;
            }}
          />

          <div className="flex items-center gap-2 pb-3">
            {restSeconds && !state.rest ? (
              <button
                type="button"
                onClick={() => player.startRest(idx, restSeconds)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border px-3 text-sm text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
              >
                <Timer className="size-4" /> {formatRest(restSeconds)}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                isLast ? player.goToSummary() : player.setActiveExercise(idx + 1)
              }
              className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-paper px-4 text-sm font-medium text-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
            >
              {isLast ? (
                <>
                  <Flag className="size-4" /> Seansı bitir
                </>
              ) : (
                <>
                  Sonraki egzersiz <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function LoggedSets({
  meta,
  sets,
  onDelete,
}: {
  meta: PlayerData["exercises"][number];
  sets: Player["state"]["exercises"][number]["sets"];
  onDelete: (localId: string) => void;
}) {
  if (sets.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
        İlk seti gir — hedef hazır, sadece onayla.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-paper-border">
      <div className="grid grid-cols-[1.5rem_1fr_1fr_1fr_1.75rem] items-center gap-2 bg-surface px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        <span className="text-center">Set</span>
        <span className="text-center">Kg</span>
        <span className="text-center">Tekrar</span>
        <span className="text-center">RPE</span>
        <span />
      </div>
      {sets.map((s, i) => {
        const prev = meta.stats.prevSessionWeights[i];
        const delta =
          prev != null && s.weight != null
            ? Math.round((s.weight - prev) * 10) / 10
            : null;
        return (
          <div
            key={s.localId}
            className={cn(
              "grid grid-cols-[1.5rem_1fr_1fr_1fr_1.75rem] items-center gap-2 border-t border-paper-border px-3 py-2 text-sm",
              s.pr && "forge-pr-glow",
            )}
          >
            <span className="text-center font-mono text-xs text-muted-foreground">{i + 1}</span>
            <span className="flex flex-col items-center leading-none">
              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-foreground">
                {formatNumber(s.weight)}
                {s.pr ? (
                  <span className="rounded bg-lab-green/15 px-1 text-[9px] font-semibold uppercase tracking-wider text-lab-green">
                    PR
                  </span>
                ) : null}
              </span>
              {delta != null && delta !== 0 ? (
                <span
                  className={cn(
                    "mt-0.5 font-mono text-[10px]",
                    delta > 0 ? "text-lab-green" : "text-lab-amber",
                  )}
                >
                  {delta > 0 ? "+" : ""}
                  {delta}
                </span>
              ) : null}
            </span>
            <span className="text-center font-mono tabular-nums text-foreground">
              {s.reps ?? "—"}
            </span>
            <span className="text-center font-mono tabular-nums text-muted-foreground">
              {s.rpe != null ? formatNumber(s.rpe) : "—"}
            </span>
            <button
              type="button"
              onClick={() => onDelete(s.localId)}
              aria-label="Seti sil"
              className="flex size-7 items-center justify-center justify-self-center text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
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

  const prExercises: SummaryExercise[] = state.exercises
    .map((ex, i) => ({
      name: data.exercises[i]?.name ?? "Egzersiz",
      prSets: ex.sets.filter((s) => s.pr).map((s) => ({ weight: s.weight, reps: s.reps })),
    }))
    .filter((e) => e.prSets.length > 0);

  return (
    <div className="relative z-10 flex-1 overflow-y-auto">
      <SessionSummary
        workoutName={data.workoutName}
        durationMs={durationMs}
        volume={Math.round(totals.volume)}
        setCount={totals.setCount}
        prCount={totals.prCount}
        prExercises={prExercises}
        insights={data.insights}
        initialNote={data.initialNote}
        onExit={onExit}
        onReopen={player.reopen}
      />
    </div>
  );
}
