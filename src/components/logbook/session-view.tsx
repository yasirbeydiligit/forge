import { CheckCircle2 } from "lucide-react";

import { PaperCard } from "@/components/lab/lab";
import { formatDate, formatNumber } from "@/lib/format";

export type SessionSetRow = {
  id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  exercise_id: string;
  exercise: { name: string } | null;
};

export type SessionRow = {
  id: string;
  session_date: string;
  completed: boolean;
  notes: string | null;
  workout: { name: string } | null;
  log_sets: SessionSetRow[];
};

function groupByExercise(sets: SessionSetRow[]) {
  const order: string[] = [];
  const map = new Map<string, { name: string; sets: SessionSetRow[] }>();
  for (const s of sets) {
    if (!map.has(s.exercise_id)) {
      map.set(s.exercise_id, { name: s.exercise?.name ?? "Egzersiz", sets: [] });
      order.push(s.exercise_id);
    }
    map.get(s.exercise_id)!.sets.push(s);
  }
  return order.map((id) => {
    const group = map.get(id)!;
    group.sets.sort((a, b) => a.set_number - b.set_number);
    return group;
  });
}

export function SessionView({ session }: { session: SessionRow }) {
  const groups = groupByExercise(session.log_sets ?? []);

  return (
    <PaperCard className="gap-0 p-0">
      <div className="flex items-center justify-between border-b border-paper-border p-4">
        <div>
          <p className="font-serif text-lg text-paper-foreground">
            {session.workout?.name ?? "Serbest antrenman"}
          </p>
          <p className="text-xs text-paper-muted">
            {formatDate(session.session_date)}
          </p>
        </div>
        {session.completed ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.14em] text-lab-green">
            <CheckCircle2 className="size-3.5" /> Tamamlandı
          </span>
        ) : (
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-paper-muted">
            Devam ediyor
          </span>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="p-4 text-sm text-paper-muted">
          Bu seansa henüz set girilmemiş.
        </p>
      ) : (
        <ul className="divide-y divide-paper-border">
          {groups.map((group, i) => (
            <li key={i} className="p-4">
              <p className="mb-2 text-sm font-medium text-paper-foreground">
                {group.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {group.sets.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex items-baseline gap-1 rounded-md border border-paper-border bg-paper-foreground/[0.04] px-2 py-1 font-mono text-xs tabular-nums text-paper-foreground"
                  >
                    <span className="text-paper-muted">{s.set_number}.</span>
                    <span className="font-semibold">{formatNumber(s.weight)}</span>
                    <span className="text-paper-muted">×</span>
                    <span className="font-semibold">{s.reps ?? "—"}</span>
                    {s.rpe ? (
                      <span className="text-paper-muted">@{formatNumber(s.rpe)}</span>
                    ) : null}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {session.notes ? (
        <p className="border-t border-paper-border p-4 font-serif text-sm italic text-paper-muted">
          “{session.notes}”
        </p>
      ) : null}
    </PaperCard>
  );
}
