import { Dumbbell } from "lucide-react";

import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20",
        className,
      )}
    >
      <Dumbbell className="size-1/2" strokeWidth={2.5} />
    </span>
  );
}

export function Brand({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark className="size-9" />
      {showName ? (
        <span className="font-serif text-xl font-semibold tracking-tight">
          {APP_NAME}
        </span>
      ) : null}
    </span>
  );
}
