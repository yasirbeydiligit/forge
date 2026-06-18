/** Pure-SVG sparkline (no chart library, server-renderable). */
export function Sparkline({
  points,
  width = 88,
  height = 26,
  className,
  color = "var(--lab-green)",
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
  /** Stroke/dot colour. Defaults to the green accent. */
  color?: string;
}) {
  if (points.length < 2) {
    return (
      <div
        style={{ width, height }}
        className="rounded bg-muted/60"
        aria-hidden
      />
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 3;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * innerW;
    const y = pad + innerH - ((p - min) / span) * innerH;
    return [x, y] as const;
  });

  const path = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
    >
      <polyline
        points={path}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2.2" fill={color} />
    </svg>
  );
}
