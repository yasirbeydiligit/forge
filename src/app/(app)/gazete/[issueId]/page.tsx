import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { IssueView } from "@/components/gazete/issue-view";
import { requireProfile } from "@/lib/auth";
import type { IssuePayload } from "@/lib/gazete/build-issue";
import { signPhysiquePaths } from "@/lib/physique";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Gazete" };

export default async function IssuePage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const profile = await requireProfile();
  const { issueId } = await params;
  const supabase = await createSupabaseServerClient();

  // RLS scopes this to the owner (or their coach) — anything else is a 404.
  const { data: issue } = await supabase
    .from("report_issues")
    .select(
      "id, athlete_id, period_type, period_start, period_end, milestone_months, issue_number, payload, read_at",
    )
    .eq("id", issueId)
    .maybeSingle();
  if (!issue) notFound();

  const payload = issue.payload as unknown as IssuePayload;
  const isOwner = issue.athlete_id === profile.id;

  // Opening your own unread copy marks it read (the read_at column is the
  // only one the athlete may update — 0031's column grant).
  if (isOwner && issue.read_at == null) {
    await supabase
      .from("report_issues")
      .update({ read_at: new Date().toISOString() })
      .eq("id", issue.id);
  }

  // Photos live in the payload as IDs; sign fresh URLs at view time.
  let photoUrls: { before: string; after: string } | null = null;
  if (payload.photos) {
    const { data: photoRows } = await supabase
      .from("physique_photos")
      .select("id, storage_path")
      .in("id", [payload.photos.beforeId, payload.photos.afterId]);
    const byId = new Map((photoRows ?? []).map((p) => [p.id, p.storage_path]));
    const beforePath = byId.get(payload.photos.beforeId);
    const afterPath = byId.get(payload.photos.afterId);
    if (beforePath && afterPath) {
      const signed = await signPhysiquePaths(supabase, [beforePath, afterPath]);
      const before = signed.get(beforePath);
      const after = signed.get(afterPath);
      if (before && after) photoUrls = { before, after };
    }
  }

  const athleteName = isOwner
    ? profile.full_name
    : ((
        await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", issue.athlete_id)
          .maybeSingle()
      ).data?.full_name ?? "Sporcu");

  return (
    <IssueView
      issue={{
        periodType: issue.period_type,
        periodStart: issue.period_start,
        periodEnd: issue.period_end,
        milestoneMonths: issue.milestone_months,
        issueNumber: issue.issue_number,
      }}
      payload={payload}
      photoUrls={photoUrls}
      athleteName={athleteName}
      backHref={isOwner ? "/gazete" : undefined}
    />
  );
}
