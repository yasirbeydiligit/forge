/**
 * Inline cited insight note — the "signature" of the Research Library feature.
 *
 * Renders a single `AthleteInsight` (from the LLM-free rule engine in
 * `src/lib/rag/insights-server.ts`) as an understated, editorial margin note in
 * the "lab notebook" paper aesthetic, woven inline next to the relevant data on
 * the athlete's own screens (nutrition, logbook, wellness).
 *
 * Visual treatment mirrors `MarginNote` in `src/components/lab/lab.tsx` (the
 * existing computed margin-note pattern): a paper card with a 2px left accent
 * rule, a small tracked-uppercase label, and serif-italic body text. The key
 * difference: a fired rule may carry a CITATION resolved from a pinned library
 * chunk, rendered as a subtle deep-link to the viewer
 * (`/kutuphane/{documentId}#chunk-{chunkId}`) — the same anchor format the chat
 * sources use — plus an optional muted quote.
 *
 * Server-compatible: no client runtime, no hooks. Safe to render directly in a
 * server component alongside `getAthleteInsights(...)`. When there are no fired
 * rules the caller simply maps an empty array → nothing renders.
 */
import Link from "next/link";

import { MarginNote } from "@/components/lab/lab";
import type { AthleteInsight } from "@/lib/rag/insights-server";

/**
 * Map an insight's scope to a margin-note accent so the inline notes pick up the
 * same colour language as the surrounding data (nutrition/protein → green,
 * training → violet, recovery → amber). Unknown/empty scopes fall back to green.
 */
function accentForScope(scope: string | null): "green" | "amber" | "violet" {
  switch (scope) {
    case "training":
      return "violet";
    case "recovery":
      return "amber";
    case "nutrition":
    default:
      return "green";
  }
}

/** Human label for the note's scope, shown in the small uppercase header. */
function labelForScope(scope: string | null): string {
  switch (scope) {
    case "training":
      return "Araştırma · Antrenman";
    case "recovery":
      return "Araştırma · Toparlanma";
    case "nutrition":
      return "Araştırma · Beslenme";
    default:
      return "Araştırma";
  }
}

export function InsightNote({ insight }: { insight: AthleteInsight }) {
  const { text, citation, scope } = insight;

  return (
    <MarginNote label={labelForScope(scope)} accent={accentForScope(scope)}>
      {text}
      {citation ? (
        <>
          {citation.quote ? (
            <span className="mt-2 block text-[13px] not-italic leading-snug text-paper-muted">
              “{citation.quote}”
            </span>
          ) : null}
          <Link
            href={`/kutuphane/${citation.documentId}#chunk-${citation.chunkId}`}
            className="mt-2 block font-sans text-[13px] not-italic text-paper-muted transition-colors hover:text-lab-link"
          >
            — {citation.title}
            {citation.pageNumber != null ? `, s.${citation.pageNumber}` : ""}
          </Link>
        </>
      ) : null}
    </MarginNote>
  );
}

/**
 * Convenience: render a list of insights as stacked notes. Callers may also map
 * `InsightNote` directly; this just wraps them with consistent vertical rhythm
 * and renders nothing when the list is empty (no fired rules).
 */
export function InsightNotes({
  insights,
  className,
}: {
  insights: AthleteInsight[];
  className?: string;
}) {
  if (insights.length === 0) return null;
  return (
    <div className={className ?? "space-y-3"}>
      {insights.map((insight) => (
        <InsightNote key={insight.key} insight={insight} />
      ))}
    </div>
  );
}
