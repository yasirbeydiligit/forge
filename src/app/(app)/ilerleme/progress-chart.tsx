"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ProgressPoint = { label: string; weight: number };

export function ProgressChart({ data }: { data: ProgressPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        Grafik için en az iki farklı günde kayıt gerekiyor.
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid
            strokeDasharray="2 4"
            stroke="var(--paper-border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{
              fill: "var(--muted-foreground)",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
            tickLine={false}
            axisLine={false}
            width={40}
            unit=" kg"
          />
          <Tooltip
            cursor={{ stroke: "var(--paper-border)" }}
            contentStyle={{
              background: "var(--popover)",
              border: "1px solid var(--paper-border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              fontFamily: "var(--font-mono)",
              boxShadow: "0 8px 24px oklch(0 0 0 / 8%)",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value) => [`${value} kg`, "En iyi set"]}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "var(--primary)", strokeWidth: 0 }}
            activeDot={{ r: 4.5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
