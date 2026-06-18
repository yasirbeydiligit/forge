/**
 * Single icon entry point.
 *
 * Today every glyph is a Lucide icon. When the bespoke Forge icon set (muscle
 * groups + equipment) arrives, only the `ICONS` registry below changes — every
 * call site (`<Icon name="chest" />`) keeps working and picks up the new art.
 * That is the whole point: one swap point instead of hunting down imports.
 *
 * Adoption is incremental. Exercise rows and the Library are the first call
 * sites the brief calls out; other screens can migrate from raw Lucide imports
 * to `<Icon name=… />` over time.
 */
import {
  Activity,
  Apple,
  BicepsFlexed,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Footprints,
  HeartPulse,
  type LucideIcon,
  type LucideProps,
  Moon,
  PersonStanding,
  Timer,
  TrendingUp,
  Weight,
} from "lucide-react";

/**
 * Registry: semantic name → glyph. Group by intent so the bespoke set can be
 * dropped in domain by domain. Keep names stable; they are the public API.
 */
export const ICONS = {
  // Research / knowledge domains (signature colour language)
  nutrition: Apple,
  recovery: Moon,
  training: Dumbbell,
  // Muscle groups (placeholder → bespoke set later)
  chest: PersonStanding,
  back: PersonStanding,
  legs: Footprints,
  arms: BicepsFlexed,
  core: Activity,
  // Equipment
  barbell: Dumbbell,
  dumbbell: Dumbbell,
  weight: Weight,
  // Misc app concepts
  calendar: CalendarDays,
  progress: TrendingUp,
  cardio: HeartPulse,
  timer: Timer,
  library: BookOpen,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, ...props }: { name: IconName } & LucideProps) {
  const Glyph = ICONS[name];
  return <Glyph {...props} />;
}
