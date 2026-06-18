import { AppShell } from "@/components/shell/app-shell";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  let unansweredCount = 0;
  if (profile.role === "coach") {
    const supabase = await createSupabaseServerClient();
    const { count } = await supabase
      .from("feed_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_question", true)
      .eq("answered", false);
    unansweredCount = count ?? 0;
  }

  return (
    <AppShell profile={profile} unansweredCount={unansweredCount}>
      {children}
    </AppShell>
  );
}
