"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Check, ChevronDown, History, Minus, Plus, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatNumber } from "@/lib/format";
import type { SetEntry } from "@/lib/session/types";
import { cn } from "@/lib/utils";

/* The player remounts this view's input block after every logged set (its key
 * includes the set count), so an animation started in the click handler dies
 * with the old instance. Stamp the submit time at module scope instead and let
 * the next instance pop its check on mount — visually one continuous "tick". */
let lastLoggedAt = 0;

const STRIP_PREF_KEY = "forge:logger:strip-open:v1";

function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** "3×5 @ 110" when the previous session was uniform, else "110×5 · 112.5×3". */
function schemeLine(sets: { weight: number; reps: number | null }[]): string | null {
  if (sets.length === 0) return null;
  const first = sets[0];
  const uniform = sets.every((s) => s.weight === first.weight && s.reps === first.reps);
  if (uniform && first.reps != null) {
    return `${sets.length}×${first.reps} @ ${formatNumber(first.weight)}`;
  }
  return sets
    .map((s) => `${formatNumber(s.weight)}×${s.reps ?? "—"}`)
    .join(" · ");
}

/* ----------------------------------------------------------------------- */
/*  Big prefilled stepper (KG / TEKRAR)                                    */
/* ----------------------------------------------------------------------- */

function BigStepper({
  label,
  value,
  step,
  min = 0,
  decimal,
  hint,
  onChange,
}: {
  label: string;
  value: number | null;
  step: number;
  min?: number;
  decimal?: boolean;
  hint?: string;
  onChange: (next: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const bump = (dir: 1 | -1) => {
    const base = value ?? 0;
    const next = Math.max(min, Math.round((base + dir * step) * 100) / 100);
    onChange(next);
  };

  const commitDraft = () => {
    setEditing(false);
    const n = parseNum(draft);
    if (n != null) onChange(Math.max(min, n));
  };

  // 112.5 → "112" + ".5"; reps stay integer-only.
  const whole = value != null ? Math.trunc(value) : null;
  const frac =
    value != null && decimal ? `.${(Math.round((value - Math.trunc(value)) * 10) + 10) % 10}` : null;

  return (
    <div className="rounded-2xl border border-border bg-paper px-3.5 py-3">
      <p className="mb-1.5 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={`${label} azalt`}
          className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
        >
          <Minus className="size-6" />
        </button>

        {editing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode={decimal ? "decimal" : "numeric"}
            autoFocus
            defaultValue={value != null ? String(value) : ""}
            aria-label={label}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraft();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-14 w-full min-w-0 rounded-xl border border-ring bg-paper text-center font-mono text-[2rem] tabular-nums text-foreground outline-none ring-[3px] ring-ring/40"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(value != null ? String(value) : "");
              setEditing(true);
            }}
            aria-label={`${label}: ${value ?? "boş"} — düzenlemek için dokun`}
            className="min-w-0 flex-1 rounded-xl px-1 font-mono text-[2.5rem] leading-none tabular-nums text-foreground"
          >
            {value != null ? (
              <>
                {whole}
                {frac ? <span className="text-xl text-muted-foreground">{frac}</span> : null}
              </>
            ) : (
              <span className="text-2xl text-muted-foreground/50">—</span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`${label} arttır`}
          className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
        >
          <Plus className="size-6" />
        </button>
      </div>
      {hint ? (
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Last-session strip (collapsible, preference remembered)                */
/* ----------------------------------------------------------------------- */

function LastSessionStrip({
  prevSessionSets,
  allTimePr,
}: {
  prevSessionSets: { weight: number; reps: number | null }[];
  allTimePr: number | null;
}) {
  // Default open; a small first viewport starts collapsed (sacrifice order #1)
  // unless the athlete has explicitly chosen. Hydration-safe: start closed and
  // resolve on mount so SSR/client markup match.
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let next = window.innerHeight >= 640;
    try {
      const pref = window.localStorage.getItem(STRIP_PREF_KEY);
      if (pref === "1") next = true;
      else if (pref === "0") next = false;
    } catch {
      /* keep height default */
    }
    setOpen(next);
    setResolved(true);
  }, []);

  const toggle = () => {
    setOpen((v) => {
      try {
        window.localStorage.setItem(STRIP_PREF_KEY, v ? "0" : "1");
      } catch {
        /* preference is best-effort */
      }
      return !v;
    });
  };

  const scheme = schemeLine(prevSessionSets);
  if (!scheme && allTimePr == null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg bg-surface px-3 font-mono text-xs text-foreground/80 transition-[padding] duration-[var(--dur-fast)] ease-soft",
        open ? "py-2" : "py-1",
        !resolved && "invisible",
      )}
    >
      <History className="size-3.5 shrink-0 text-muted-foreground" />
      {open ? (
        <span className="min-w-0 flex-1 truncate text-left">
          {scheme ? `Geçen: ${scheme}` : null}
          {scheme && allTimePr != null ? " · " : null}
          {allTimePr != null ? `PR ${formatNumber(allTimePr)} kg` : null}
        </span>
      ) : (
        <span className="flex-1 text-left text-muted-foreground">Geçen seans</span>
      )}
      <ChevronDown
        className={cn(
          "size-3.5 shrink-0 text-muted-foreground transition-transform duration-[var(--dur-base)] ease-soft",
          !open && "-rotate-90",
        )}
      />
    </button>
  );
}

/* ----------------------------------------------------------------------- */
/*  Set pills                                                              */
/* ----------------------------------------------------------------------- */

function SetPills({
  sets,
  targetSets,
  onDelete,
}: {
  sets: SetEntry[];
  targetSets: number | null;
  onDelete: (localId: string) => void;
}) {
  // Always render the active (next) pill; extra sets beyond target just extend the row.
  const count = Math.max(targetSets ?? 0, sets.length + 1);
  const pills = Array.from({ length: count }, (_, i) => i);

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {pills.map((i) => {
        const done = sets[i];
        const active = i === sets.length;
        if (done) {
          return (
            <DropdownMenu key={done.localId}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    // Sacrifice order #2: pills give up height before the steppers ever would.
                    "min-w-0 flex-1 basis-0 rounded-[10px] border border-lab-green/30 bg-lab-green/10 px-1 py-2 text-center font-mono text-[11px] text-lab-green [@media(max-height:640px)]:py-1",
                    done.pr && "forge-pr-glow",
                  )}
                >
                  <Check className="mr-0.5 inline size-3" aria-hidden />
                  {formatNumber(done.weight) ?? "—"}×{done.reps ?? "—"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="z-[70]">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(done.localId)}
                >
                  <Trash2 className="size-4" /> Seti sil ({formatNumber(done.weight)}×
                  {done.reps ?? "—"})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        return (
          <div
            key={`p-${i}`}
            aria-current={active ? "step" : undefined}
            className={cn(
              "min-w-0 flex-1 basis-0 rounded-[10px] border px-1 py-2 text-center font-mono text-[11px] [@media(max-height:640px)]:py-1",
              active
                ? "border-2 border-primary py-[7px] font-semibold text-foreground [@media(max-height:640px)]:py-[3px]"
                : "border-border bg-paper text-muted-foreground/60",
            )}
          >
            SET {i + 1}
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------------- */
/*  Screen 1 — one screen, one set                                         */
/* ----------------------------------------------------------------------- */

const RIR_CHOICES = [
  { value: 0, label: "0" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4+" },
] as const;

export function ActiveSetView({
  sets,
  targetSets,
  suggestedWeight,
  suggestedReps,
  prevSessionSets,
  allTimePr,
  onCompleteSet,
  onDeleteSet,
}: {
  sets: SetEntry[];
  targetSets: number | null;
  suggestedWeight: number | null;
  suggestedReps: number | null;
  prevSessionSets: { weight: number; reps: number | null }[];
  allTimePr: number | null;
  onCompleteSet: (input: {
    weight: number | null;
    reps: number | null;
    rir: number | null;
    note: string | null;
  }) => void;
  onDeleteSet: (localId: string) => void;
}) {
  // Prefilled: the athlete completes most sets without touching anything.
  const [weight, setWeight] = useState<number | null>(suggestedWeight);
  const [reps, setReps] = useState<number | null>(suggestedReps);
  const [rir, setRir] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const tickRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = tickRef.current;
    if (!el || Date.now() - lastLoggedAt > 600) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        gsap.from(el, { scale: 0, rotation: -30, duration: 0.3, ease: "back.out(2.5)" });
      });
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  const submit = () => {
    if (weight == null && reps == null) return;
    lastLoggedAt = Date.now();
    onCompleteSet({ weight, reps, rir, note: note.trim() ? note.trim() : null });
  };

  return (
    <div className="flex flex-col gap-3">
      <LastSessionStrip prevSessionSets={prevSessionSets} allTimePr={allTimePr} />

      <SetPills sets={sets} targetSets={targetSets} onDelete={onDeleteSet} />

      <BigStepper
        label="KG"
        value={weight}
        step={2.5}
        decimal
        hint="±2,5 · sayıya dokunup yazabilirsin"
        onChange={setWeight}
      />
      <BigStepper label="TEKRAR" value={reps} step={1} onChange={setReps} />

      <div className="flex items-center gap-2" role="group" aria-label="RIR (yedekte kalan tekrar), opsiyonel">
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          RIR
        </span>
        <div className="flex min-w-0 flex-1 gap-1.5">
          {RIR_CHOICES.map((c) => {
            const on = rir === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => setRir(on ? null : c.value)}
                className={cn(
                  "min-w-0 flex-1 rounded-lg border py-2.5 text-center font-mono text-[13px] transition-colors duration-[var(--dur-fast)] ease-soft",
                  on
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border bg-paper text-muted-foreground",
                )}
              >
                {on ? <Check className="mr-0.5 inline size-3" aria-hidden /> : null}
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {showNote ? (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          autoFocus
          placeholder="Set notu — his, tempo, ağrı…"
          className="w-full resize-none rounded-xl border border-border bg-paper px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-ring focus:ring-[3px] focus:ring-ring/40"
        />
      ) : null}

      <button
        type="button"
        onClick={submit}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-base font-semibold text-primary-foreground shadow-raised transition-[transform,background-color] duration-[var(--dur-fast)] ease-soft active:scale-[0.98] active:bg-primary/90"
      >
        <span ref={tickRef} className="inline-flex">
          <Check className="size-5" />
        </span>
        Seti tamamla
      </button>

      <button
        type="button"
        onClick={() => setShowNote((v) => !v)}
        className="mx-auto -mt-1 flex h-9 items-center px-3 text-xs text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:text-foreground"
      >
        {showNote ? "notu gizle" : "+ not ekle"}
      </button>
    </div>
  );
}
