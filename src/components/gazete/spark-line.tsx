"use client";

/**
 * Tiny inline sparkline for the lead story: a polyline that draws itself in
 * (DrawSVG) inside the issue's entrance timeline. Pure presentational; the
 * parent owns the animation trigger via the data attribute.
 */
export function SparkLine({ points, className }: { points: number[]; className?: string }) {
  const W = 240;
  const H = 56;
  const PAD = 4;
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  const coords = points
    .map((v, i) => {
      const x = PAD + i * step;
      const y = H - PAD - (v / max) * (H - PAD * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      role="img"
      aria-label="Dönem aktivite grafiği"
    >
      <polyline
        data-issue-spark
        points={coords}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((v, i) => {
        if (v === 0) return null;
        const x = PAD + i * step;
        const y = H - PAD - (v / max) * (H - PAD * 2);
        return <circle key={i} cx={x} cy={y} r="2.5" fill="currentColor" />;
      })}
    </svg>
  );
}
