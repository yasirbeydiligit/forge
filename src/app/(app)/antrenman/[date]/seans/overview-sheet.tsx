"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ArrowLeftRight, Check, ChevronDown, Loader2, Plus, Undo2, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { suggestAlternatives } from "@/lib/exercises/alternatives";
import {
  exerciseCategories,
  exerciseRegions,
  filterExercises,
} from "@/lib/exercises/filter";
import type { AddedExerciseInput, SubstituteInput } from "@/lib/session/reducer";
import type { AlternativeSuggestion } from "@/components/programs/types";
import { cn } from "@/lib/utils";

import {
  getSubstituteStatsAction,
  listExercisesForPickerAction,
  type PickerExercise,
} from "./actions";

export type OverviewExercise = {
  index: number;
  /** Resolved display name (substitute's when a muadil swap is active). */
  name: string;
  /** Exercise id sets currently log under (for alternative suggestions). */
  exerciseId: string;
  originalExerciseId: string | null;
  done: boolean;
  active: boolean;
  setsDone: number;
  targetSets: number | null;
  /** "4 set · 80–85 kg" for done rows, "3 × 10–12 · 1 dk 30 sn" for future. */
  subLine: string;
  canSwap: boolean;
  /** Session-added exercise with nothing logged yet — removable. */
  canRemove: boolean;
};

/**
 * Screen 3 — the workout at a glance. Opens from the exercise title; hosts the
 * muadil picker (session-scoped swap) and the amber, confirmed finish.
 */
export function OverviewSheet({
  open,
  onClose,
  workoutName,
  timerLabel,
  date,
  exercises,
  setTotals,
  autoRest,
  soundHaptics,
  onAutoRest,
  onSoundHaptics,
  onJump,
  onSubstitute,
  onAdd,
  onRemove,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  workoutName: string;
  timerLabel: string | null;
  date: string;
  exercises: OverviewExercise[];
  setTotals: { done: number; target: number };
  autoRest: boolean;
  soundHaptics: boolean;
  onAutoRest: (v: boolean) => void;
  onSoundHaptics: (v: boolean) => void;
  onJump: (index: number) => void;
  onSubstitute: (index: number, substitute: SubstituteInput) => void;
  onAdd: (exercise: AddedExerciseInput) => void;
  onRemove: (index: number) => void;
  onFinish: () => void;
}) {
  const [swapFor, setSwapFor] = useState<OverviewExercise | null>(null);
  const [alts, setAlts] = useState<AlternativeSuggestion[] | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const doneCount = exercises.filter((e) => e.done).length;
  const incomplete = exercises.filter((e) => !e.done);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = panelRef.current;
    if (!open || !el) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // Opaque full-screen layer: slide only — an opacity tween would ghost the
      // screen underneath through it.
      const ctx = gsap.context(() => {
        gsap.from(el, { yPercent: 6, duration: 0.3, ease: "power2.out" });
      });
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (swapFor) setSwapFor(null);
      else if (addOpen) setAddOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, swapFor, addOpen, onClose]);

  // Load suggestions when the picker opens (RLS-aware pattern+muscle match).
  useEffect(() => {
    if (!swapFor) return;
    let cancelled = false;
    setAlts(null);
    suggestAlternatives(swapFor.exerciseId)
      .then((res) => {
        if (!cancelled) setAlts(res);
      })
      .catch(() => {
        if (!cancelled) setAlts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [swapFor]);

  if (!open) return null;

  const pick = async (ex: OverviewExercise, s: { exerciseId: string; name: string; category: string | null }) => {
    setApplying(s.exerciseId);
    try {
      const res = await getSubstituteStatsAction({ exerciseId: s.exerciseId, date });
      const stats =
        "stats" in res
          ? res.stats
          : { allTimePr: null, prevSessionWeights: [], prevSessionSets: [], prHistory: [] };
      onSubstitute(ex.index, {
        exerciseId: s.exerciseId,
        name: s.name,
        category: s.category,
        stats,
      });
      setSwapFor(null);
    } finally {
      setApplying(null);
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-[55] flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Antrenman genel bakış"
    >
      <div
        aria-hidden
        className="paper-grain pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-multiply"
      />

      <header className="pt-safe relative z-10 flex h-16 shrink-0 items-center justify-between gap-2 px-4">
        <button
          type="button"
          onClick={() => {
            if (swapFor) setSwapFor(null);
            else if (addOpen) setAddOpen(false);
            else onClose();
          }}
          className="flex min-w-0 items-center gap-1.5 text-left"
          aria-label="Genel bakışı kapat"
        >
          <span className="truncate font-serif text-xl text-lab-ink">{workoutName}</span>
          <ChevronDown className="size-4 shrink-0 rotate-180 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-2">
          {timerLabel ? (
            <span className="font-mono text-sm tabular-nums text-lab-green">{timerLabel}</span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-6">
        <div className="mx-auto w-full max-w-md lg:max-w-xl">
          <p className="mb-4 text-xs text-muted-foreground">
            {doneCount}/{exercises.length} egzersiz · {setTotals.done}/{setTotals.target} set
            tamamlandı
          </p>

          {addOpen ? (
            <AddExercisePanel
              date={date}
              onAdd={(e) => {
                onAdd(e);
                setAddOpen(false);
              }}
              onBack={() => setAddOpen(false)}
            />
          ) : swapFor ? (
            /* ---- Muadil picker ---- */
            <div>
              <p className="mb-1 text-label text-muted-foreground">Muadil seç</p>
              <p className="mb-3 text-sm text-foreground">
                <span className="font-medium">{swapFor.name}</span> yerine — aynı hareket
                paterni, aynı birincil bölge. Bu seansa özel; program değişmez.
              </p>

              {alts === null ? (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Muadiller aranıyor…
                </div>
              ) : (
                <div className="space-y-2">
                  {swapFor.originalExerciseId ? (
                    <button
                      type="button"
                      disabled={applying != null}
                      onClick={() =>
                        pick(swapFor, {
                          exerciseId: swapFor.originalExerciseId!,
                          name: "",
                          category: null,
                        })
                      }
                      className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border bg-paper px-3.5 py-3 text-left text-sm text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
                    >
                      <Undo2 className="size-4 shrink-0" />
                      Programdaki egzersize geri dön
                    </button>
                  ) : null}

                  {alts.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                      Uygun muadil bulunamadı.
                    </p>
                  ) : (
                    alts.map((a) => (
                      <button
                        key={a.exerciseId}
                        type="button"
                        disabled={applying != null}
                        onClick={() =>
                          pick(swapFor, {
                            exerciseId: a.exerciseId,
                            name: a.name,
                            category: a.movementPattern,
                          })
                        }
                        className="flex w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted disabled:opacity-60"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">{a.name}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {[
                              a.equipmentType,
                              a.sharedPrimary > 0 ? `${a.sharedPrimary} ortak bölge` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        {applying === a.exerciseId ? (
                          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                        ) : (
                          <ArrowLeftRight className="size-4 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    ))
                  )}

                  <button
                    type="button"
                    onClick={() => setSwapFor(null)}
                    className="mx-auto flex h-10 items-center px-4 text-sm text-muted-foreground"
                  >
                    Vazgeç
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ---- Exercise list ---- */
            <>
              <ul className="space-y-2">
                {exercises.map((ex) => (
                  <li key={ex.index}>
                    <div
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border bg-card px-3 py-3",
                        ex.active ? "border-2 border-primary px-[11px] py-[11px]" : "border-border",
                      )}
                    >
                      {ex.done ? (
                        <Check className="size-4 shrink-0 text-lab-green" aria-label="Tamamlandı" />
                      ) : (
                        <span
                          aria-hidden
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            ex.active ? "bg-primary" : "bg-border",
                          )}
                        />
                      )}

                      <button
                        type="button"
                        onClick={() => onJump(ex.index)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p
                          className={cn(
                            "truncate text-sm",
                            ex.done && "text-muted-foreground line-through",
                            ex.active && "font-semibold",
                          )}
                        >
                          {ex.name}
                        </p>
                        <p className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
                          {ex.subLine}
                        </p>
                      </button>

                      {ex.active ? (
                        <button
                          type="button"
                          onClick={() => onJump(ex.index)}
                          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-lab-green"
                        >
                          Devam et
                        </button>
                      ) : ex.canSwap ? (
                        <button
                          type="button"
                          onClick={() => setSwapFor(ex)}
                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border px-2.5 text-[11px] text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
                        >
                          <ArrowLeftRight className="size-3" aria-hidden /> muadil
                        </button>
                      ) : null}
                      {ex.canRemove ? (
                        <button
                          type="button"
                          onClick={() => onRemove(ex.index)}
                          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border px-2.5 text-[11px] text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
                        >
                          <X className="size-3" aria-hidden /> kaldır
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mt-2 flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
              >
                <Plus className="size-4" aria-hidden /> hareket ekle
              </button>

              <div className="mt-5 space-y-2.5 rounded-xl border border-border bg-paper px-3.5 py-3">
                <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                  Otomatik dinlenme
                  <Switch checked={autoRest} onCheckedChange={onAutoRest} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm text-foreground">
                  Ses & titreşim
                  <Switch checked={soundHaptics} onCheckedChange={onSoundHaptics} />
                </label>
              </div>

              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="mt-4 h-12 w-full rounded-xl border border-lab-amber bg-lab-amber/10 text-sm font-medium text-lab-amber transition-colors duration-[var(--dur-fast)] ease-soft active:bg-lab-amber/20"
              >
                Antrenmanı bitir
              </button>
            </>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="z-[70] max-w-sm">
          <DialogHeader>
            <DialogTitle>Antrenmanı bitir?</DialogTitle>
            <DialogDescription>
              {incomplete.length > 0
                ? `${incomplete.length} egzersizde tamamlanmamış set var (${incomplete
                    .map((e) => e.name)
                    .slice(0, 3)
                    .join(", ")}${incomplete.length > 3 ? "…" : ""}). Yine de bitirilsin mi?`
                : "Tüm setler tamamlandı. Seans özetine geçilecek."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="h-11 flex-1 rounded-xl border border-border bg-paper text-sm text-foreground"
            >
              Devam et
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmOpen(false);
                onFinish();
              }}
              className="h-11 flex-1 rounded-xl border border-lab-amber bg-lab-amber/10 text-sm font-medium text-lab-amber"
            >
              Bitir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Hareket ekle — muscle-group + region picker (session-scoped)           */
/* ----------------------------------------------------------------------- */

const SET_COUNT_CHOICES = [2, 3, 4, 5] as const;

/** Rest default for session-added exercises (no program row to prescribe one). */
const ADDED_REST_SECONDS = 90;

function AddExercisePanel({
  date,
  onAdd,
  onBack,
}: {
  date: string;
  onAdd: (exercise: AddedExerciseInput) => void;
  onBack: () => void;
}) {
  const [list, setList] = useState<PickerExercise[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [selected, setSelected] = useState<PickerExercise | null>(null);
  const [setCount, setSetCount] = useState<number>(3);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listExercisesForPickerAction()
      .then((res) => {
        if (cancelled) return;
        if ("exercises" in res) {
          setList(res.exercises);
          // Start on the first muscle group so the list is never a flat dump.
          setCategory((c) => c ?? exerciseCategories(res.exercises)[0] ?? null);
        } else {
          setLoadFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => (list ? exerciseCategories(list) : []), [list]);
  const regions = useMemo(
    () => (list && category ? exerciseRegions(list, category) : []),
    [list, category],
  );
  const filtered = useMemo(
    () =>
      list
        ? filterExercises(list, {
            category: category ?? undefined,
            region: region ?? undefined,
          })
        : [],
    [list, category, region],
  );

  const confirmAdd = async (exercise: PickerExercise) => {
    setAdding(true);
    try {
      // The exercise's own history → last-session strip + live PR detection.
      const res = await getSubstituteStatsAction({ exerciseId: exercise.id, date });
      const stats =
        "stats" in res
          ? res.stats
          : { allTimePr: null, prevSessionWeights: [], prevSessionSets: [], prHistory: [] };
      const localKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? `local-${crypto.randomUUID()}`
          : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      onAdd({
        localKey,
        exerciseId: exercise.id,
        name: exercise.name,
        category: exercise.category,
        target: {
          sets: setCount,
          repsMin: null,
          repsMax: null,
          weight: null,
          rir: null,
          restSeconds: ADDED_REST_SECONDS,
        },
        stats,
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <p className="mb-1 text-label text-muted-foreground">Hareket ekle</p>
      <p className="mb-3 text-sm text-foreground">
        Kas grubu ve bölgeye göre seç. Bu seansa özel; program değişmez.
      </p>

      {loadFailed ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
          Egzersizler yüklenemedi — bağlantını kontrol et.
        </p>
      ) : list === null ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Egzersizler yükleniyor…
        </div>
      ) : (
        <>
          <div className="no-scrollbar -mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setCategory(c);
                  setRegion(null);
                  setSelected(null);
                }}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors duration-[var(--dur-fast)] ease-soft",
                  category === c
                    ? "border-primary/40 bg-primary/10 font-semibold text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          {regions.length > 0 ? (
            <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
              <button
                type="button"
                onClick={() => setRegion(null)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors duration-[var(--dur-fast)] ease-soft",
                  region === null
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                Tümü
              </button>
              {regions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRegion(r);
                    setSelected(null);
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors duration-[var(--dur-fast)] ease-soft",
                    region === r
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                Bu seçimde egzersiz yok.
              </p>
            ) : (
              filtered.map((e) => {
                const isSel = selected?.id === e.id;
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "rounded-xl border bg-card transition-colors duration-[var(--dur-fast)] ease-soft",
                      isSel ? "border-primary/40" : "border-border",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(isSel ? null : e)}
                      className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{e.name}</p>
                        {e.region ? (
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {e.region}
                          </p>
                        ) : null}
                      </div>
                      <Plus
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-base)] ease-soft",
                          isSel && "rotate-45 text-primary",
                        )}
                        aria-hidden
                      />
                    </button>

                    {isSel ? (
                      <div className="flex items-center gap-2 border-t border-border px-3.5 py-2.5">
                        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                          Set
                        </span>
                        <div className="flex flex-1 gap-1.5">
                          {SET_COUNT_CHOICES.map((n) => (
                            <button
                              key={n}
                              type="button"
                              aria-pressed={setCount === n}
                              onClick={() => setSetCount(n)}
                              className={cn(
                                "min-w-0 flex-1 rounded-lg border py-1.5 text-center font-mono text-[13px] transition-colors duration-[var(--dur-fast)] ease-soft",
                                setCount === n
                                  ? "border-primary bg-primary/10 font-semibold text-primary"
                                  : "border-border bg-paper text-muted-foreground",
                              )}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={adding}
                          onClick={() => confirmAdd(e)}
                          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-transform duration-[var(--dur-fast)] ease-soft active:scale-[0.98] disabled:opacity-60"
                        >
                          {adding ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          Ekle
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <button
            type="button"
            onClick={onBack}
            className="mx-auto mt-2 flex h-10 items-center px-4 text-sm text-muted-foreground"
          >
            Vazgeç
          </button>
        </>
      )}
    </div>
  );
}
