"use client";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
} from "recharts";

interface Props {
  confidence: number;
  size?: number;
}

function ringColor(c: number): string {
  if (c >= 0.8) return "var(--rep-high)";
  if (c >= 0.5) return "var(--rep-mid)";
  return "var(--rep-low)";
}

export function ConfidenceRing({ confidence, size = 64 }: Props) {
  const data = [
    { name: "confidence", value: Math.round(confidence * 100), fill: ringColor(confidence) },
  ];

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
            barSize={6}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={3}
              background={{ fill: "var(--surface-2)" }}
              animationDuration={800}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] font-mono font-semibold text-[var(--text-primary)]">
            {Math.round(confidence * 100)}
          </span>
        </div>
      </div>
    </div>
  );
}
