import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Newspaper } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { requireCoach } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import type { IssuePayload } from "@/lib/gazete/build-issue";
import { periodLabel, type Period } from "@/lib/gazete/periods";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Gazete Arşivi" };

const TYPE_LABEL = { weekly: "Haftalık", monthly: "Aylık", milestone: "Özel" } as const;

/**
 * Coach view of an athlete's printed issues — read-only (RLS grants select;
 * printing only ever happens on the athlete's own visit, so an archive the
 * athlete hasn't opened yet may simply not exist).
 */
export default async function CoachGazetePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  await requireCoach();
  const { athleteId } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: athlete } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", athleteId)
    .maybeSingle();
  if (!athlete) notFound();

  const { data: issues } = await supabase
    .from("report_issues")
    .select("id, period_type, period_start, period_end, milestone_months, issue_number, payload, created_at")
    .eq("athlete_id", athleteId)
    .order("period_end", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/panel/sporcular/${athleteId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {athlete.full_name}
      </Link>

      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight text-lab-ink">
          Gazete Arşivi
        </h1>
        <p className="text-sm text-muted-foreground">
          {athlete.full_name} adına basılan sayılar — salt okunur.
        </p>
      </div>

      {(issues ?? []).length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title="Henüz basılmış sayı yok"
          description="Sayılar sporcu Gazete'yi ilk açtığında basılır."
        />
      ) : (
        <div className="divide-y divide-paper-border overflow-hidden rounded-xl border border-paper-border bg-paper paper-shadow">
          {(issues ?? []).map((issue) => {
            const period: Period =
              issue.period_type === "milestone"
                ? {
                    type: "milestone",
                    start: issue.period_start,
                    end: issue.period_end,
                    months: issue.milestone_months ?? 0,
                  }
                : {
                    type: issue.period_type,
                    start: issue.period_start,
                    end: issue.period_end,
                  };
            return (
              <Link
                key={issue.id}
                href={`/gazete/${issue.id}`}
                className="flex items-baseline gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
              >
                <span
                  className={cn(
                    "shrink-0 font-mono text-[10px] uppercase tracking-widest",
                    issue.period_type === "milestone"
                      ? "font-bold text-lab-amber"
                      : "text-muted-foreground",
                  )}
                >
                  {issue.period_type === "milestone"
                    ? `${issue.milestone_months}. AY ÖZEL`
                    : `${TYPE_LABEL[issue.period_type]} ${issue.issue_number}`}
                </span>
                <span className="min-w-0 flex-1 truncate font-serif text-base text-lab-ink">
                  {(issue.payload as unknown as IssuePayload).headline.title}
                </span>
                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground sm:inline">
                  {periodLabel(period)}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {formatDate(issue.created_at, "d MMM")}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
