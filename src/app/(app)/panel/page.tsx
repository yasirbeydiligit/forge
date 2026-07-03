import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  Dumbbell,
  Flame,
  MessageSquareWarning,
  Send,
  TriangleAlert,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PaperCard, SectionLabel } from "@/components/lab/lab";
import { MeasureCard } from "@/components/measure-card";
import { PageHeader } from "@/components/shell/page-header";
import { DigestBanner } from "@/components/triage/digest-banner";
import { Button } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { formatRelative } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadTriage } from "@/lib/triage/load-triage";
import type { Invite } from "@/lib/types";

import { TriageBoard } from "./triage-board";

export const metadata: Metadata = { title: "Panel" };

export default async function CoachDashboardPage() {
  const coach = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const [
    { count: athleteCount },
    { count: programCount },
    { data: invitesData },
    { data: unanswered },
    triage,
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
    loadTriage(),
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

  const { attentionCount, criticalCount } = triage;
  const criticalNames = triage.results
    .filter((r) => r.band === "red")
    .map((r) => r.fullName);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Merhaba, ${firstName}`}
        description="Topluluğunun özetine göz at ve cevap bekleyen soruları yanıtla."
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
        <MeasureCard
          icon={TriangleAlert}
          label="Dikkat"
          value={attentionCount}
          accent="rose"
          emphasis={attentionCount > 0}
          hint={criticalCount > 0 ? `${criticalCount} kritik` : undefined}
        />
      </div>

      {/* Aggregated daily digest — the in-app "notification", no push fatigue. */}
      <DigestBanner
        attentionCount={attentionCount}
        criticalCount={criticalCount}
        criticalNames={criticalNames}
      />

      <section className="space-y-3">
        <SectionLabel>Triyaj — bugün kiminle ilgilenmelisin</SectionLabel>
        <TriageBoard results={triage.results} />
      </section>

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
                <PaperCard className="flex flex-col gap-1 border-l-2 border-l-lab-amber p-4 transition-[transform,box-shadow] duration-[var(--dur-base)] ease-soft hover:-translate-y-0.5 hover:shadow-raised">
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
    <Link href={href} className="group">
      <PaperCard className="flex flex-col items-center gap-2 p-4 text-center transition-[transform,box-shadow] duration-[var(--dur-base)] ease-soft hover:-translate-y-0.5 hover:shadow-raised active:translate-y-0">
        <span className="flex size-10 items-center justify-center rounded-xl bg-paper-foreground/[0.06] text-lab-green transition-colors duration-[var(--dur-base)] group-hover:bg-lab-green/10">
          <Icon className="size-5" />
        </span>
        <span className="text-sm font-medium text-paper-foreground">{label}</span>
      </PaperCard>
    </Link>
  );
}
