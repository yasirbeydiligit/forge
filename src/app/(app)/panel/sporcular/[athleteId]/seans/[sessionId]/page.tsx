import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import {
  fmtDuration,
  SessionReportView,
} from "@/app/(app)/antrenman/[date]/seans/session-report-view";
import { loadSessionReportById } from "@/app/(app)/antrenman/[date]/seans/report-loader";
import { requireCoach } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Seans raporu" };

export default async function CoachSessionReportPage({
  params,
}: {
  params: Promise<{ athleteId: string; sessionId: string }>;
}) {
  await requireCoach();
  const { athleteId, sessionId } = await params;
  const supabase = await createSupabaseServerClient();

  const result = await loadSessionReportById(supabase, sessionId);
  if (!result) notFound();
  const { report, meta } = result;

  return (
    <div className="mx-auto w-full max-w-md space-y-6 py-2">
      <Link
        href={`/panel/sporcular/${athleteId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Sporcuya dön
      </Link>

      <div>
        <p className="text-label text-lab-green">
          {formatDate(meta.sessionDate, "d MMMM yyyy")}
          {meta.completed ? " · tamamlandı" : " · devam ediyor"}
        </p>
        <h1 className="text-display mt-1 text-lab-ink">{meta.workoutName}</h1>
      </div>

      {report && report.totalSets > 0 ? (
        <>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-paper-border bg-paper-border">
            <Metric label="Süre" value={meta.durationMs != null ? fmtDuration(meta.durationMs) : "—"} />
            <Metric label="Hacim" value={String(report.totalSets)} unit="set" />
            <Metric label="Rekor" value={String(report.prCount)} sub={report.rirPrCount > 0 ? `+${report.rirPrCount} RIR` : "PR"} />
          </div>

          <SessionReportView report={report} />

          {meta.notes ? (
            <div className="space-y-2">
              <p className="text-label text-muted-foreground">Sporcunun seans notu</p>
              <p className="rounded-xl border border-paper-border bg-paper p-3 text-sm text-paper-foreground">
                {meta.notes}
              </p>
            </div>
          ) : null}
        </>
      ) : (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Bu seansta raporlanacak set yok.
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="bg-paper px-2 py-4 text-center">
      <p className="font-serif text-2xl leading-none text-paper-foreground">
        {value}
        {unit ? <span className="ml-0.5 font-mono text-xs text-paper-muted">{unit}</span> : null}
      </p>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-paper-muted">{label}</p>
      {sub ? (
        <p className="mt-0.5 font-mono text-[10px] tabular-nums text-paper-muted">{sub}</p>
      ) : null}
    </div>
  );
}
