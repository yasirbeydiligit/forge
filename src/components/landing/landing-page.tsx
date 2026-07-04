/**
 * Landing page — "Sayı 01". The marketing face of Forge, composed as the cover
 * and opening spread of the training journal the product already is: masthead
 * hero, register ticker, three-column iç sayfa, the self-writing logbook
 * scene, a specimen season, a pull quote and a colophon. Server component;
 * motion lives in the small client pieces it composes.
 */
import Link from "next/link";

import { Brand } from "@/components/brand";
import { PaperGrain } from "@/components/paper-grain";
import { Button } from "@/components/ui/button";
import { AthleteSpread } from "@/components/landing/athlete-spread";
import { CoachSpread } from "@/components/landing/coach-spread";
import { LandingHero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { LibrarySection } from "@/components/landing/library-section";
import { LogbookScene } from "@/components/landing/logbook-scene";
import { RegisterTicker } from "@/components/landing/ticker";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { SeasonStats } from "@/components/landing/season-stats";

export function LandingPage() {
  return (
    <div className="relative min-h-dvh overflow-x-clip">
      <PaperGrain />

      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Brand />
          <Button asChild size="sm">
            <Link href="/login">Giriş yap</Link>
          </Button>
        </div>
      </header>

      <main>
        <LandingHero />
        <RegisterTicker />
        <HowItWorks />
        <LogbookScene />
        <AthleteSpread />
        <CoachSpread />
        <LibrarySection />
        <SeasonStats />

        {/* Pull quote, in the app's signature left-stripe research-card voice. */}
        <ScrollReveal className="mx-auto w-full max-w-3xl px-4 pb-20 sm:px-6 sm:pb-28">
          <blockquote className="rounded-xl border border-paper-border border-l-2 border-l-lab-green bg-paper p-6 paper-shadow sm:p-8">
            <p className="font-serif text-2xl leading-snug font-medium text-lab-ink italic sm:text-3xl">
              &ldquo;Yazmak, antrenmanın yarısıdır.&rdquo;
            </p>
            <footer className="text-label mt-4 text-muted-foreground">
              Forge yöntemi — s. 1
            </footer>
          </blockquote>
        </ScrollReveal>

        {/* Davet: closed community, honest CTA. */}
        <ScrollReveal className="mx-auto w-full max-w-5xl px-4 pb-24 text-center sm:px-6 sm:pb-32">
          <p className="text-label text-muted-foreground">Katılım</p>
          <h2
            className="mx-auto mt-3 max-w-xl font-serif font-medium tracking-[-0.02em] text-lab-ink"
            style={{ fontSize: "clamp(1.875rem, 5vw, 3rem)", lineHeight: 1.1 }}
          >
            Forge davetle çalışır.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Kayıt yalnızca koçundan gelen davet bağlantısıyla açılır — tek
            kullanımlık ya da süreli. Hesabın varsa giriş yap; yoksa koçundan
            bir davet linki iste.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" className="px-10">
              <Link href="/login">Giriş yap</Link>
            </Button>
          </div>
        </ScrollReveal>
      </main>

      {/* Colophon: the journal's imprint page, in miniature. */}
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-label text-muted-foreground">
              Forge · Sayı 01 · Temmuz 2026
            </p>
            <p className="font-mono text-[0.6875rem] leading-relaxed text-muted-foreground/80">
              Newsreader, Geist Sans ve Geist Mono ile dizilmiştir.
              <br className="sm:hidden" /> Krem kâğıda dijital baskı. ©{" "}
              {new Date().getFullYear()} Forge.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
