"use client";

/**
 * Wraps the Bugün page sections and lifts them into view on mount — a soft
 * bottom-up stagger that gives the "command center" a composed entrance without
 * shouting. Children render server-side as normal; this only animates the DOM.
 * With prefers-reduced-motion it is a no-op (everything is already in place).
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

export function RevealStagger({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const items = Array.from(root.children) as HTMLElement[];
    const ctx = gsap.context(() => {
      gsap.from(items, {
        y: 10,
        opacity: 0,
        duration: 0.4,
        ease: "power2.out",
        stagger: 0.06,
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
