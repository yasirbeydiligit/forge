import { cn } from "@/lib/utils";

/**
 * The FORGE GAZETE nameplate band — shared by the kiosk and the issue page.
 * Server-safe (no motion here; entrances belong to the client scenes).
 */
export function Masthead({
  issueLine,
  editionLine,
  className,
}: {
  /** e.g. "Sayı 3 · 29 Haziran – 5 Temmuz 2026" */
  issueLine?: string;
  /** e.g. "Ahmet Yasir adına özel baskı" */
  editionLine?: string;
  className?: string;
}) {
  return (
    <header className={cn("border-y-2 border-lab-ink/80 py-3 text-center", className)}>
      <p
        data-masthead-name
        className="font-serif text-3xl font-semibold uppercase tracking-[0.18em] text-lab-ink sm:text-4xl"
      >
        Forge Gazete
      </p>
      {issueLine || editionLine ? (
        <div className="mt-2 flex flex-col items-center gap-0.5 border-t border-lab-ink/20 pt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground sm:flex-row sm:justify-center sm:gap-3">
          {issueLine ? <span>{issueLine}</span> : null}
          {issueLine && editionLine ? (
            <span aria-hidden className="hidden sm:inline">
              ·
            </span>
          ) : null}
          {editionLine ? <span>{editionLine}</span> : null}
        </div>
      ) : null}
    </header>
  );
}
