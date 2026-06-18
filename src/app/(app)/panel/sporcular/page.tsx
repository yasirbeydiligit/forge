import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";

import { getInitials } from "@/components/shell/user-menu";
import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { PageHeader } from "@/components/shell/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { requireCoach } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sporcular" };

type AthleteRow = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  created_at: string;
  enrollments: { count: number }[];
  log_sessions: { count: number }[];
};

export default async function AthletesPage() {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, created_at, enrollments(count), log_sessions(count)")
    .eq("role", "athlete")
    .order("full_name", { ascending: true });

  const athletes = (data ?? []) as AthleteRow[];

  return (
    <div>
      <PageHeader
        title="Sporcular"
        description="Topluluğundaki sporcuları ve antrenman geçmişlerini takip et."
      />

      {athletes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Henüz sporcu yok"
          description="Davetler sekmesinden bir davet bağlantısı oluşturup paylaş."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {athletes.map((a) => (
            <Link key={a.id} href={`/panel/sporcular/${a.id}`} className="group">
              <PaperCard className="flex flex-row items-center gap-3 p-4 transition-shadow group-hover:shadow-md">
                <Avatar className="size-11 border border-paper-border">
                  {a.avatar_url ? (
                    <AvatarImage src={a.avatar_url} alt={a.full_name} />
                  ) : null}
                  <AvatarFallback className="bg-paper-foreground/[0.06] text-sm font-semibold text-paper-foreground">
                    {getInitials(a.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-lg text-paper-foreground">
                    {a.full_name}
                  </p>
                  <p className="text-xs text-paper-muted">
                    {formatDate(a.created_at)} tarihinde katıldı
                  </p>
                  <div className="mt-1.5 flex gap-3 font-mono text-xs tabular-nums text-paper-muted">
                    <span>{a.enrollments[0]?.count ?? 0} program</span>
                    <span>·</span>
                    <span>{a.log_sessions[0]?.count ?? 0} seans</span>
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-paper-muted" />
              </PaperCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
