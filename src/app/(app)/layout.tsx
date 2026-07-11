import { AppShell } from "@/components/shell/app-shell";
import { requireProfile } from "@/lib/auth";
import { loadGazeteSignal } from "@/lib/gazete/signal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadTriage } from "@/lib/triage/load-triage";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  let unansweredCount = 0;
  let attentionCount = 0;
  let gazeteCount = 0;
  if (profile.role === "athlete") {
    // Request-cached; the Bugün discovery card reuses this computation.
    gazeteCount = (await loadGazeteSignal(profile.id)).newCount;
  }
  if (profile.role === "coach") {
    const supabase = await createSupabaseServerClient();
    // loadTriage is request-cached, so the panel page reuses this computation.
    const [{ count }, triage] = await Promise.all([
      supabase
        .from("feed_posts")
        .select("id", { count: "exact", head: true })
        .eq("is_question", true)
        .eq("answered", false),
      loadTriage(),
    ]);
    unansweredCount = count ?? 0;
    attentionCount = triage.attentionCount;
  }

  return (
    <AppShell
      profile={profile}
      unansweredCount={unansweredCount}
      attentionCount={attentionCount}
      gazeteCount={gazeteCount}
    >
      {children}
    </AppShell>
  );
}
