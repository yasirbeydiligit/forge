"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  Camera,
  ClipboardList,
  Dumbbell,
  Flame,
  FlaskConical,
  LayoutDashboard,
  Library,
  LineChart,
  type LucideIcon,
  MessageSquare,
  Newspaper,
  NotebookPen,
  Send,
  UtensilsCrossed,
  Users,
} from "lucide-react";

import { Brand } from "@/components/brand";
import { PaperGrain } from "@/components/paper-grain";
import { UserMenu } from "@/components/shell/user-menu";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/lib/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  /** rose = attention/alert badge; default is the primary green. */
  badgeTone?: "primary" | "rose";
};

function buildNav(
  profile: Profile,
  unansweredCount: number,
  attentionCount: number,
  gazeteCount: number,
) {
  if (profile.role === "coach") {
    const primary: NavItem[] = [
      {
        href: "/panel",
        label: "Panel",
        icon: LayoutDashboard,
        exact: true,
        badge: attentionCount,
        badgeTone: "rose",
      },
      { href: "/panel/programlar", label: "Programlar", icon: Dumbbell },
      { href: "/panel/takvim", label: "Takvim", icon: CalendarDays },
      { href: "/panel/sporcular", label: "Sporcular", icon: Users },
      {
        href: "/feed",
        label: "Feed",
        icon: MessageSquare,
        badge: unansweredCount,
      },
    ];
    const secondary: NavItem[] = [
      { href: "/panel/egzersizler", label: "Egzersiz Kütüphanesi", icon: Flame },
      { href: "/panel/protokoller", label: "Protokoller", icon: FlaskConical },
      { href: "/panel/kutuphane", label: "Kütüphane Yönetimi", icon: Library },
      { href: "/kutuphane", label: "Kütüphane", icon: BookOpen },
      { href: "/panel/davetler", label: "Davetler", icon: Send },
      {
        href: "/panel/sorular",
        label: "Cevaplanmamış Sorular",
        icon: MessageSquare,
        badge: unansweredCount,
      },
    ];
    return { primary, secondary };
  }

  const primary: NavItem[] = [
    { href: "/bugun", label: "Bugün", icon: Flame, exact: true },
    { href: "/takvim", label: "Takvim", icon: CalendarDays },
    { href: "/takip", label: "Takip", icon: ClipboardList },
    { href: "/ilerleme", label: "İlerleme", icon: LineChart },
    { href: "/feed", label: "Feed", icon: MessageSquare },
  ];
  const secondary: NavItem[] = [
    { href: "/gazete", label: "Gazete", icon: Newspaper, badge: gazeteCount },
    { href: "/beslenme", label: "Beslenme", icon: UtensilsCrossed },
    { href: "/fizik", label: "Fizik", icon: Camera },
    { href: "/programlar", label: "Programlar", icon: Dumbbell, exact: true },
    { href: "/programlarim", label: "Programlarım", icon: NotebookPen },
    { href: "/egzersizlerim", label: "Egzersizlerim", icon: Dumbbell },
    { href: "/kutuphane", label: "Kütüphane", icon: BookOpen },
  ];
  return { primary, secondary };
}

function useIsActive() {
  const pathname = usePathname();
  return (item: NavItem) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function NavBadge({ count, tone }: { count?: number; tone?: "primary" | "rose" }) {
  if (!count) return null;
  return (
    <Badge
      className={cn(
        "ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]",
        tone === "rose" && "bg-lab-rose text-white",
      )}
    >
      {count}
    </Badge>
  );
}

export function AppShell({
  profile,
  unansweredCount,
  attentionCount = 0,
  gazeteCount = 0,
  children,
}: {
  profile: Profile;
  unansweredCount: number;
  attentionCount?: number;
  gazeteCount?: number;
  children: React.ReactNode;
}) {
  const { primary, secondary } = buildNav(
    profile,
    unansweredCount,
    attentionCount,
    gazeteCount,
  );
  const isActive = useIsActive();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <PaperGrain />
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-sidebar/60 p-4 md:flex">
        <div className="px-2 py-3">
          <Brand />
        </div>

        <nav className="mt-4 flex flex-1 flex-col gap-1">
          {primary.map((item) => (
            <SideLink key={item.href} item={item} active={isActive(item)} />
          ))}

          {secondary.length > 0 ? (
            <>
              <p className="mt-6 px-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {profile.role === "coach" ? "Yönetim" : "Daha fazla"}
              </p>
              {secondary.map((item) => (
                <SideLink key={item.href} item={item} active={isActive(item)} />
              ))}
            </>
          ) : null}
        </nav>

        <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card/60 p-2.5">
          <UserMenu profile={profile} align="start" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {profile.role === "coach" ? "Koç" : "Sporcu"}
            </p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-col">
        {/* Mobile top bar */}
        <header className="pt-safe sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:hidden">
          <Brand />
          <UserMenu profile={profile} />
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pb-12 md:pt-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {primary.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors duration-[var(--dur-fast)] ease-soft",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active ? (
                  <span
                    aria-hidden
                    className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary"
                  />
                ) : null}
                <span className="relative">
                  <Icon className="size-5" />
                  {item.badge ? (
                    <span
                      className={cn(
                        "absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold",
                        item.badgeTone === "rose"
                          ? "bg-lab-rose text-white"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="truncate">{item.label}</span>
      <NavBadge count={item.badge} tone={item.badgeTone} />
    </Link>
  );
}
