/**
 * The coach's aggregated daily digest — the deliberate in-app replacement for
 * push notifications: one calm line ("bugün N sporcu dikkat istiyor") instead
 * of a ping per alert. Server-safe.
 */
import { TriangleAlert } from "lucide-react";

import { PaperCard } from "@/components/lab/lab";
import { cn } from "@/lib/utils";

export function DigestBanner({
  attentionCount,
  criticalCount,
  criticalNames,
}: {
  attentionCount: number;
  criticalCount: number;
  criticalNames: string[];
}) {
  const tone =
    criticalCount > 0 ? "rose" : attentionCount > 0 ? "amber" : "green";
  return (
    <PaperCard
      className={cn(
        "flex items-center gap-3 border-l-2 p-4",
        tone === "rose" && "border-l-lab-rose",
        tone === "amber" && "border-l-lab-amber",
        tone === "green" && "border-l-lab-green",
      )}
    >
      <TriangleAlert
        className={cn(
          "size-5 shrink-0",
          tone === "rose" && "text-lab-rose",
          tone === "amber" && "text-lab-amber",
          tone === "green" && "text-lab-green",
        )}
      />
      <p className="font-serif text-[15px] italic text-paper-foreground">
        {attentionCount > 0 ? (
          <>
            Bugün {attentionCount} sporcu dikkat istiyor
            {criticalCount > 0 ? (
              <>
                {" · "}
                <span className="text-lab-rose">
                  {criticalCount} kritik ({criticalNames.join(", ")})
                </span>
              </>
            ) : null}
            .
          </>
        ) : (
          "Bugün dikkat isteyen sporcu yok."
        )}
      </p>
    </PaperCard>
  );
}
