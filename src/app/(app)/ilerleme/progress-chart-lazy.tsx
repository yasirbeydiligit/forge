"use client";

import dynamic from "next/dynamic";

import type { ProgressPoint } from "./progress-chart";

/**
 * Client-only lazy wrapper so recharts (~100 kB) is loaded in a separate chunk
 * on demand instead of shipping in the initial page bundle.
 */
export const ProgressChartLazy = dynamic(
  () => import("./progress-chart").then((m) => m.ProgressChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-56 w-full animate-pulse rounded-lg bg-muted/40" />
    ),
  },
);

export type { ProgressPoint };
