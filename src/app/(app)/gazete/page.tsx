import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Kiosk, type KioskIssue } from "@/components/gazete/kiosk";
import { EmptyState } from "@/components/empty-state";
import { Newspaper } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import type { IssuePayload } from "@/lib/gazete/build-issue";
import { generateDueIssues } from "@/lib/gazete/loader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gazete" };

export default async function GazetePage() {
  const profile = await requireProfile();
  // Coaches read their athletes' copies from the panel; printing only ever
  // runs for the athlete's own account.
  if (profile.role === "coach") redirect("/panel/sporcular");

  const supabase = await createSupabaseServerClient();
  await generateDueIssues(supabase, profile.id);

  const { data } = await supabase
    .from("report_issues")
    .select("id, period_type, period_start, period_end, milestone_months, issue_number, payload, read_at")
    .eq("athlete_id", profile.id)
    .order("period_end", { ascending: false })
    .order("period_type", { ascending: true });

  const issues: KioskIssue[] = (data ?? []).map((row) => ({
    id: row.id,
    periodType: row.period_type,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    milestoneMonths: row.milestone_months,
    issueNumber: row.issue_number,
    headline: (row.payload as unknown as IssuePayload).headline.title,
    unread: row.read_at == null,
  }));

  if (issues.length === 0) {
    return (
      <EmptyState
        icon={Newspaper}
        title="İlk sayın baskıda"
        description="Forge Gazete, ilk antrenman haftan kapandığında basılır. Sen antrenmanına bak — manşeti biz hallederiz."
      />
    );
  }

  return <Kiosk issues={issues} />;
}
