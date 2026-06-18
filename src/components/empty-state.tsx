import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  illustration,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Optional editorial illustration (e.g. a future Higgsfield asset). Takes
   * precedence over `icon`. */
  illustration?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-paper-border bg-paper px-6 py-14 text-center paper-shadow",
        className,
      )}
    >
      {illustration ? (
        <div className="mb-5">{illustration}</div>
      ) : Icon ? (
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-paper-foreground/[0.05] text-lab-green">
          <Icon className="size-6" />
        </div>
      ) : null}
      <h3 className="font-serif text-xl text-paper-foreground">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-paper-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
