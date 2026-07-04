"use client";

/**
 * A mono/serif figure that counts up from 0 to its value on mount — the house
 * "measurement comes alive" gesture, reused across the Bugün summary boxes.
 * SSR renders the final formatted value (works without JS, no layout shift);
 * with prefers-reduced-motion it stays at the final value.
 *
 * Formatting stays serializable (server → client): `decimals` controls the
 * fraction digits, `grouped` toggles Turkish thousands separators (numbers like
 * steps/kcal) vs. a plain fixed decimal (weight, matching the tracker's "79.4").
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

export function AnimatedNumber({
  value,
  decimals = 0,
  grouped = true,
  duration = 0.6,
  className,
}: {
  value: number;
  decimals?: number;
  grouped?: boolean;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const format = (n: number) =>
    grouped
      ? n.toLocaleString("tr-TR", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : n.toFixed(decimals);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = format(value);
      return;
    }
    const counter = { value: 0 };
    const ctx = gsap.context(() => {
      gsap.to(counter, {
        value,
        duration,
        ease: "power2.out",
        onUpdate: () => {
          el.textContent = format(counter.value);
        },
      });
    });
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, decimals, grouped, duration]);

  return (
    <span ref={ref} className={className}>
      {format(value)}
    </span>
  );
}
