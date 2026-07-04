"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { Check, Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

/* The player remounts <SetInput> after every logged set (its key includes the
 * set count), so an animation started in the click handler dies with the old
 * instance. Stamp the submit time at module scope instead and let the next
 * instance pop its check on mount — visually one continuous "tick". */
let lastLoggedAt = 0;

type Props = {
  setNumber: number;
  suggestedWeight: number | null;
  suggestedReps: number | null;
  targetRir: number | null;
  weightStep?: number;
  /** Returns true when the logged set was a PR (so the caller can celebrate). */
  onComplete: (input: {
    weight: number | null;
    reps: number | null;
    rir: number | null;
    note: string | null;
  }) => boolean;
};

function parseNum(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** A big-target stepper field: − / numeric input / +. */
function Stepper({
  value,
  placeholder,
  step,
  min = 0,
  max,
  decimal,
  ariaLabel,
  unit,
  onChange,
}: {
  value: string;
  placeholder: string;
  step: number;
  min?: number;
  max?: number;
  decimal?: boolean;
  ariaLabel: string;
  unit?: string;
  onChange: (next: string) => void;
}) {
  const bump = (dir: 1 | -1) => {
    const current = parseNum(value);
    const base = current ?? parseNum(placeholder) ?? 0;
    let next = base + dir * step;
    next = Math.max(min, max != null ? Math.min(max, next) : next);
    next = Math.round(next * 100) / 100;
    onChange(String(next));
  };

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => bump(-1)}
        aria-label={`${ariaLabel} azalt`}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
      >
        <Minus className="size-5" />
      </button>
      <div className="relative flex-1">
        <input
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-full rounded-xl border border-border bg-paper text-center font-mono text-lg tabular-nums text-foreground outline-none transition-colors duration-[var(--dur-fast)] placeholder:text-muted-foreground/45 focus:border-ring focus:ring-[3px] focus:ring-ring/40"
        />
        {unit ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-muted-foreground/70">
            {unit}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => bump(1)}
        aria-label={`${ariaLabel} arttır`}
        className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-soft active:bg-muted"
      >
        <Plus className="size-5" />
      </button>
    </div>
  );
}

export function SetInput({
  setNumber,
  suggestedWeight,
  suggestedReps,
  targetRir,
  weightStep = 2.5,
  onComplete,
}: Props) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rir, setRir] = useState("");
  const [note, setNote] = useState("");
  const [showRir, setShowRir] = useState(false);
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
    const w = parseNum(weight) ?? suggestedWeight;
    const r = parseNum(reps) ?? suggestedReps;
    if (w == null && r == null) return;
    lastLoggedAt = Date.now();
    onComplete({
      weight: w,
      reps: r,
      rir: parseNum(rir),
      note: note.trim() ? note.trim() : null,
    });
    setWeight("");
    setReps("");
    setRir("");
    setNote("");
    setShowNote(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-label text-muted-foreground">Set {setNumber}</span>
        <div className="flex items-center gap-1.5">
          <Chip active={showRir} onClick={() => setShowRir((v) => !v)}>
            RIR
          </Chip>
          <Chip active={showNote} onClick={() => setShowNote((v) => !v)}>
            + Not
          </Chip>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Ağırlık
          </p>
          <Stepper
            value={weight}
            placeholder={suggestedWeight != null ? String(suggestedWeight) : "kg"}
            step={weightStep}
            decimal
            ariaLabel="Ağırlık"
            unit="kg"
            onChange={setWeight}
          />
        </div>
        <div className="space-y-1">
          <p className="text-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Tekrar
          </p>
          <Stepper
            value={reps}
            placeholder={suggestedReps != null ? String(suggestedReps) : "tekrar"}
            step={1}
            ariaLabel="Tekrar"
            onChange={setReps}
          />
        </div>
      </div>

      {showRir ? (
        <div className="space-y-1">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            RIR {targetRir != null ? `· hedef ${targetRir}` : ""}
          </p>
          <Stepper
            value={rir}
            placeholder={targetRir != null ? String(targetRir) : "—"}
            step={0.5}
            min={0}
            max={10}
            decimal
            ariaLabel="RIR"
            onChange={setRir}
          />
          <p className="text-[10px] text-muted-foreground">
            RIR = Yedekte kalan tekrar (0 = tam başarısızlık)
          </p>
        </div>
      ) : null}

      {showNote ? (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
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
        Set tamamlandı
      </button>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] ease-soft",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
