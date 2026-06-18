/**
 * Paper grain atmosphere. A fixed, non-interactive overlay that lays a faint
 * tiled noise over the cream page so it reads as printed paper rather than a
 * flat fill. Opaque card surfaces cover it, so the grain only shows in the
 * page gutters — exactly where the "paper" should breathe.
 *
 * The texture itself lives in the `--grain-image` CSS variable (a tiny inline
 * fractal-noise SVG by default). To swap in a real Higgsfield asset later, set
 * `--grain-image: url("/textures/grain.png")` on `:root` — no code change here.
 */
export function PaperGrain() {
  return (
    <div
      aria-hidden
      className="paper-grain pointer-events-none fixed inset-0 -z-10 opacity-[0.04] mix-blend-multiply"
    />
  );
}
