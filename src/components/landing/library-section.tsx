"use client";

/**
 * "Bölüm — Kütüphane": the research library, staged. A chat specimen — one of
 * the app's real suggestion questions, an answer, and the "Kaynaklar" source
 * card with page + excerpt — followed by an InsightNote in the exact
 * left-stripe MarginNote grammar, showing notes land on screens by themselves.
 * The promise is the app's own line: answers rely only on library sources and
 * always come with a citation.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function LibrarySection() {
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
        tl.from("[data-lib-question]", { autoAlpha: 0, y: 12, duration: 0.45 })
          .from(
            "[data-lib-answer]",
            { autoAlpha: 0, y: 10, duration: 0.5 },
            "+=0.15",
          )
          .from(
            "[data-lib-source]",
            { autoAlpha: 0, x: -12, duration: 0.45 },
            "+=0.1",
          )
          .from(
            "[data-lib-note]",
            { autoAlpha: 0, y: 14, duration: 0.5 },
            "+=0.15",
          );
      }, root);
      return () => ctx.revert();
    });
    return () => mm.revert();
  }, []);

  return (
    <section
      ref={rootRef}
      aria-labelledby="kutuphane-bolumu"
      className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-28"
    >
      <p className="text-label text-muted-foreground">Bölüm — Kütüphane</p>
      <h2 id="kutuphane-bolumu" className="text-h1 mt-2 text-lab-ink">
        Sorulara kaynaklı cevap
      </h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Koç hakemli makaleleri kütüphaneye yükler; sen soru sorarsın. Yanıtlar
        yalnızca kütüphanedeki kaynaklara dayanır ve her zaman alıntıyla gelir
        — havadan tavsiye yok.
      </p>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
        {/* Chat specimen: question → answer → Kaynaklar. */}
        <div className="rounded-xl border border-paper-border bg-paper p-5 text-paper-foreground paper-shadow sm:p-6">
          <p className="text-label text-muted-foreground">Kütüphaneye sor</p>

          <div className="mt-4 flex justify-end">
            <p
              data-lib-question
              className="max-w-[85%] rounded-xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground"
            >
              Haftalık antrenman hacmi ne kadar olmalı?
            </p>
          </div>

          <div data-lib-answer className="mt-4 max-w-[92%]">
            <p className="text-sm leading-relaxed text-foreground">
              Kütüphanedeki derlemeler, kas grubu başına haftada{" "}
              <span className="font-medium">10–20 set</span> aralığını
              hipertrofi için güçlü bir başlangıç olarak gösteriyor; alt uçtan
              başlayıp toparlanmana göre artırmak öneriliyor.
            </p>
          </div>

          <div data-lib-source className="mt-4">
            <p className="text-label text-muted-foreground">Kaynaklar</p>
            <div className="mt-2 rounded-lg border border-paper-border bg-surface p-3">
              <p className="text-sm font-medium text-foreground">
                Resistance Training Volume and Hypertrophy{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  s.12
                </span>
              </p>
              <p className="text-caption mt-1 text-muted-foreground italic">
                &ldquo;…10 to 20 weekly sets per muscle group appears to
                maximize the hypertrophic response in trained
                individuals…&rdquo;
              </p>
            </div>
          </div>
        </div>

        {/* InsightNote: the woven-in note, in its real MarginNote grammar. */}
        <div className="lg:pt-8">
          <div
            data-lib-note
            className="rounded-xl border border-paper-border border-l-2 border-l-lab-green bg-paper p-5 text-paper-foreground paper-shadow"
          >
            <p className="text-label text-lab-green">Araştırma · Beslenme</p>
            <p className="mt-2.5 font-serif text-base leading-relaxed text-lab-ink italic">
              Son 7 günde protein ortalaman 1,4 g/kg — kütüphanedeki
              1,6–2,2 g/kg aralığının altında.
            </p>
            <p className="text-caption mt-3 text-muted-foreground">
              — Protein and Resistance Training, s.4
            </p>
          </div>
          <p className="text-caption mt-4 max-w-sm text-muted-foreground">
            Bu notlar ekranlarına kendiliğinden düşer — beslenmede,
            antrenmanda, takipte. Kural tabanlı çalışır; her not kaynağına
            bağlıdır.
          </p>
        </div>
      </div>
    </section>
  );
}
