import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Dumbbell,
  Flame,
  MessageSquareWarning,
  Send,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { MeasureCard } from "@/components/measure-card";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { formatRelative } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Invite } from "@/lib/types";

export const metadata: Metadata = { title: "Panel" };

export default async function CoachDashboardPage() {
  const coach = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const [
    { count: athleteCount },
    { count: programCount },
    { data: invitesData },
    { data: unanswered },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "athlete"),
    supabase.from("programs").select("id", { count: "exact", head: true }),
    supabase.from("invites").select("*"),
    supabase
      .from("feed_posts")
      .select("id, body, created_at, author:profiles!feed_posts_author_id_profiles_id_fk(full_name)")
      .eq("is_question", true)
      .eq("answered", false)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const now = Date.now();
  const activeInvites = ((invitesData ?? []) as Invite[]).filter(
    (i) =>
      i.uses < i.max_uses &&
      (!i.expires_at || new Date(i.expires_at).getTime() > now),
  ).length;

  const questions = (unanswered ?? []) as unknown as {
    id: string;
    body: string;
    created_at: string;
    author: { full_name: string } | null;
  }[];

  const firstName = coach.full_name.split(" ")[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Merhaba, ${firstName}`}
        description="Topluluğunun özetine göz at ve cevap bekleyen soruları yanıtla."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MeasureCard icon={Users} label="Sporcu" value={athleteCount ?? 0} />
        <MeasureCard icon={Dumbbell} label="Program" value={programCount ?? 0} />
        <MeasureCard icon={Send} label="Aktif davet" value={activeInvites} />
        <MeasureCard
          icon={MessageSquareWarning}
          label="Bekleyen soru"
          value={questions.length}
          accent="amber"
          emphasis={questions.length > 0}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquareWarning className="size-5 text-primary" />
            Cevaplanmamış sorular
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/panel/sorular">Tümü</Link>
          </Button>
        </div>

        {questions.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Her şey güncel 🎯"
            description="Cevap bekleyen soru yok. Harika gidiyorsun!"
          />
        ) : (
          <div className="space-y-2">
            {questions.map((q) => (
              <Link key={q.id} href="/feed">
                <PaperCard className="flex flex-col gap-1 p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-paper-foreground">
                      {q.author?.full_name ?? "Sporcu"}
                    </p>
                    <span className="text-xs text-paper-muted">
                      {formatRelative(q.created_at)}
                    </span>
                  </div>
                  <p className="line-clamp-2 font-serif text-[15px] italic text-paper-muted">
                    {q.body}
                  </p>
                </PaperCard>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Hızlı işlemler</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickLink href="/panel/programlar" icon={Dumbbell} label="Program oluştur" />
          <QuickLink href="/panel/takvim" icon={CalendarDays} label="Takvime ata" />
          <QuickLink href="/panel/egzersizler" icon={Flame} label="Egzersiz ekle" />
          <QuickLink href="/panel/davetler" icon={Send} label="Davet üret" />
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Dumbbell;
  label: string;
}) {
  return (
    <Link href={href}>
      <PaperCard className="flex flex-col items-center gap-2 p-4 text-center transition-shadow hover:shadow-md">
        <span className="flex size-10 items-center justify-center rounded-xl bg-paper-foreground/[0.06] text-lab-green">
          <Icon className="size-5" />
        </span>
        <span className="text-sm font-medium text-paper-foreground">{label}</span>
      </PaperCard>
    </Link>
  );
}
