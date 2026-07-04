"use client";

/**
 * "Bir sezonun dökümü" — a specimen season rendered as big serif counters
 * (mono captions, tr-TR digit grouping) that count up once when the band
 * scrolls into view. Explicitly labelled a specimen; these are not live
 * product metrics. Static values render server-side; motion only replays them.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STATS = [
  { value: 12, label: "hafta" },
  { value: 48, label: "antrenman" },
  { value: 4820, label: "set" },
  { value: 212400, label: "kg tonaj" },
];

const formatTr = (n: number) => Math.round(n).toLocaleString("tr-TR");

export function SeasonStats() {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const ctx = gsap.context(() => {
        const numbers = root.querySelectorAll<HTMLElement>("[data-stat-value]");
        gsap.from(root.querySelectorAll("[data-stat]"), {
          autoAlpha: 0,
          y: 14,
          duration: 0.5,
          stagger: 0.08,
          ease: "power2.out",
          scrollTrigger: { trigger: root, start: "top 75%", once: true },
        });
        numbers.forEach((el) => {
          const target = Number(el.dataset.statValue);
          const proxy = { n: 0 };
          gsap.to(proxy, {
            n: target,
            duration: 1.4,
            ease: "power2.out",
            scrollTrigger: { trigger: root, start: "top 75%", once: true },
            onUpdate: () => {
              el.textContent = formatTr(proxy.n);
            },
          });
        });
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      aria-labelledby="sezon-dokumu"
      className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="sezon-dokumu" className="text-h1 text-lab-ink">
          Bir sezonun dökümü
        </h2>
        <p className="text-label text-muted-foreground">Örnek dönem *</p>
      </div>
      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 border-y border-border py-10 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.label} data-stat className="min-w-0">
            <dd
              data-stat-value={stat.value}
              className="font-serif font-medium tracking-tight text-lab-ink tabular-nums"
              style={{ fontSize: "clamp(2rem, 5vw, 3.25rem)", lineHeight: 1 }}
            >
              {formatTr(stat.value)}
            </dd>
            <dt className="text-label mt-2.5 text-muted-foreground">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>
      <p className="text-caption mt-4 text-muted-foreground">
        * 12 haftalık bir ara dönemin defter dökümünden alınmış numunedir.
      </p>
    </section>
  );
}
