/**
 * "Lab notebook" design-system primitives: an editorial aesthetic — warm cream
 * paper surfaces on a neutral near-black canvas, serif display headings, small
 * tracked uppercase labels and tabular figures. Currently used by the pilot
 * screens (Bugün, Logbook). Server-safe (no client runtime).
 */
import { cn } from "@/lib/utils";

/** Full-bleed neutral backdrop that overrides the global tinted glow. The
 * opaque fill would otherwise hide the app-shell grain, so it carries its own
 * grain layer to keep the paper texture on lab pages. */
export function LabBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-lab-bg">
      <div className="paper-grain absolute inset-0 opacity-[0.04] mix-blend-multiply" />
    </div>
  );
}

export function LabPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <LabBackdrop />
      <div className={cn("mx-auto w-full max-w-3xl", className)}>{children}</div>
    </>
  );
}

export function LabHeader({
  metaLeft,
  metaRight,
  title,
  subtitle,
}: {
  metaLeft?: React.ReactNode;
  metaRight?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      {metaLeft || metaRight ? (
        <div className="text-label mb-5 flex items-center justify-between text-muted-foreground">
          <span>{metaLeft}</span>
          <span className="text-right">{metaRight}</span>
        </div>
      ) : null}
      <h1 className="text-display text-lab-ink">{title}</h1>
      {subtitle ? (
        <p className="mt-2 font-serif text-base italic text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}

export function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("text-label text-muted-foreground", className)}>
      {children}
    </p>
  );
}

export function PaperCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-paper-border bg-paper text-paper-foreground paper-shadow",
        className,
      )}
    >
      {children}
    </div>
  );
}

const ACCENTS = {
  green: { text: "text-lab-green", border: "border-l-lab-green" },
  amber: { text: "text-lab-amber", border: "border-l-lab-amber" },
  violet: { text: "text-lab-violet", border: "border-l-lab-violet" },
  blue: { text: "text-lab-blue", border: "border-l-lab-blue" },
} as const;

export function MarginNote({
  label,
  children,
  footer,
  accent = "green",
  className,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  accent?: keyof typeof ACCENTS;
  className?: string;
}) {
  const a = ACCENTS[accent];
  return (
    <PaperCard className={cn("border-l-2 p-4", a.border, className)}>
      {label ? (
        <p className={cn("text-label mb-1.5", a.text)}>{label}</p>
      ) : null}
      <div className="font-serif text-[15px] italic leading-relaxed text-paper-foreground">
        {children}
      </div>
      {footer ? <div className="mt-2 text-sm">{footer}</div> : null}
    </PaperCard>
  );
}

/** Small inline link styled for the lab aesthetic (calm blue, ↗). */
export function LabLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="font-sans text-sm font-medium text-lab-link hover:underline"
    >
      {children}
    </a>
  );
}
