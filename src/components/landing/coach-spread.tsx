"use client";

/**
 * "Forma II — Koç": the panel, digested. A triage card (durum skoru ring
 * counting up, the two-tier alert families with the app's verbatim captions)
 * and a haftalık kas raporu card (per-exercise table with RIR + PR columns and
 * the amber plateau "dikkat" note). Copy uses the panel's own vocabulary.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { AlertTriangle, Trophy } from "lucide-react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

const SCORE = 62;
const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

const ALERTS = [
  {
    family: "Uyum — kayıp sinyali",
    frame: "border-dashed border-lab-amber/60",
    title: "3 gündür öğün kaydı yok",
  },
  {
    family: "Performans — zorlanma sinyali",
    frame: "border-lab-violet/50",
    title: "RIR sinyali uç değerde",
  },
];

const REPORT_ROWS = [
  { name: "Back Squat", sets: 5, rir: "2,0", pr: true },
  { name: "Romanian DL", sets: 4, rir: "2,5", pr: false },
  { name: "Leg Press", sets: 4, rir: "1,5", pr: false },
];

export function CoachSpread() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: "power2.out" },
          scrollTrigger: { trigger: root, start: "top 72%", once: true },
        });
        tl.from("[data-coach-card]", {
          autoAlpha: 0,
          y: 18,
          duration: 0.5,
          stagger: 0.12,
        });

        // Durum skoru: ring sweeps and the number counts to SCORE together.
        const ring = root.querySelector<SVGCircleElement>("[data-score-ring]");
        const num = root.querySelector<HTMLElement>("[data-score-value]");
        if (ring && num) {
          const proxy = { n: 0 };
          tl.fromTo(
            ring,
            { strokeDashoffset: RING_C },
            {
              strokeDashoffset: RING_C * (1 - SCORE / 100),
              duration: 1.1,
              ease: "power2.inOut",
            },
            "-=0.2",
          ).to(
            proxy,
            {
              n: SCORE,
              duration: 1.1,
              ease: "power2.inOut",
              onUpdate: () => {
                num.textContent = String(Math.round(proxy.n));
              },
            },
            "<",
          );
        }

        tl.from(
          "[data-alert-row]",
          { autoAlpha: 0, x: -10, duration: 0.4, stagger: 0.12 },
          "-=0.6",
        )
          .from(
            "[data-report-row]",
            { autoAlpha: 0, y: 8, duration: 0.35, stagger: 0.08 },
            "-=0.3",
          )
          .from("[data-plateau-note]", { autoAlpha: 0, y: 8, duration: 0.4 }, "-=0.1");
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      aria-labelledby="koc-formasi"
      className="border-y border-border bg-surface/60"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
        <p className="text-label text-muted-foreground">Forma II — Koç</p>
        <h2 id="koc-formasi" className="text-h1 mt-2 text-lab-ink">
          Koç ham veri okumaz
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Panel her sabah triyajı çıkarır: kim dikkat istiyor, kim sorunsuz.
          Haftalık raporlar sindirilmiş gelir — uyum, set hacmi, kişisel
          rekorlar. Programı yazarsın; gerisini defter anlatır.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          {/* Triyaj: digest line + durum skoru ring + two-tier alerts. */}
          <div
            data-coach-card
            className="rounded-xl border border-paper-border bg-paper p-5 text-paper-foreground paper-shadow sm:p-6"
          >
            <p className="text-label text-muted-foreground">
              Triyaj — bugün kiminle ilgilenmelisin
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Bugün <span className="font-medium text-foreground">2 sporcu</span>{" "}
              dikkat istiyor · <span className="text-lab-rose">1 kritik</span>.
            </p>

            <div className="mt-5 flex items-center gap-4">
              <div className="relative size-16 shrink-0">
                <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r={RING_R}
                    fill="none"
                    className="stroke-surface"
                    strokeWidth="5"
                  />
                  <circle
                    data-score-ring
                    cx="32"
                    cy="32"
                    r={RING_R}
                    fill="none"
                    className="stroke-lab-amber"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - SCORE / 100)}
                  />
                </svg>
                <span
                  data-score-value
                  className="absolute inset-0 flex items-center justify-center font-mono text-sm font-semibold tabular-nums text-lab-ink"
                >
                  {SCORE}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-serif text-base text-lab-ink">Demir A.</p>
                <p className="text-caption text-muted-foreground">
                  durum skoru · son 7 gün
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-2.5">
              {ALERTS.map((alert) => (
                <div
                  key={alert.title}
                  data-alert-row
                  className={cn("rounded-lg border p-3", alert.frame)}
                >
                  <p className="text-[0.625rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                    {alert.family}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{alert.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Haftalık kas raporu: set count, RIR, PR — and the plateau note. */}
          <div
            data-coach-card
            className="rounded-xl border border-paper-border bg-paper p-5 text-paper-foreground paper-shadow sm:p-6"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-label text-muted-foreground">
                Haftalık kas raporu
              </p>
              <p className="font-mono text-[0.6875rem] text-muted-foreground">
                son 8 hafta
              </p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Toplam <span className="font-medium text-foreground">24 set</span> ·
              5 kas grubu
            </p>

            <table className="mt-4 w-full font-mono text-sm">
              <thead>
                <tr className="text-left text-[0.625rem] tracking-[0.12em] text-muted-foreground uppercase">
                  <th className="pb-2 font-medium">Hareket</th>
                  <th className="pb-2 text-right font-medium">Set</th>
                  <th className="pb-2 text-right font-medium">RIR</th>
                  <th className="pb-2 text-right font-medium">PR</th>
                </tr>
              </thead>
              <tbody>
                {REPORT_ROWS.map((row) => (
                  <tr
                    key={row.name}
                    data-report-row
                    className="border-t border-paper-border/70"
                  >
                    <td className="py-2 pr-2">{row.name}</td>
                    <td className="py-2 text-right tabular-nums">{row.sets}</td>
                    <td className="py-2 text-right tabular-nums">{row.rir}</td>
                    <td className="py-2 text-right">
                      {row.pr ? (
                        <Trophy className="ml-auto size-3.5 text-lab-green" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div
              data-plateau-note
              className="mt-4 flex items-start gap-2 rounded-lg border border-lab-amber/50 bg-lab-amber/5 p-3"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-lab-amber" />
              <p className="text-caption text-foreground">
                <span className="font-medium">dikkat</span> — Son 3 seanstır
                ilerleme yok, gözden geçirilebilir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
