import type { LucideIcon } from "lucide-react";

import { PaperCard } from "@/components/lab/lab";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <PaperCard className={cn("p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="text-label text-paper-muted">{label}</span>
        <span className="text-lab-green">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-2 font-serif text-3xl tabular-nums text-paper-foreground">
        {value}
      </div>
      {hint ? <p className="mt-0.5 text-xs text-paper-muted">{hint}</p> : null}
    </PaperCard>
  );
}
