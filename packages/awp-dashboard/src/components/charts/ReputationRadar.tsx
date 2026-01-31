"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";
import type { DimensionSummary } from "@/lib/types";

interface Props {
  dimensions: DimensionSummary[];
}

const labelMap: Record<string, string> = {
  reliability: "Reliability",
  "epistemic-hygiene": "Epistemic",
  coordination: "Coordination",
};

export function ReputationRadar({ dimensions }: Props) {
  const data = dimensions.map((d) => ({
    dimension: labelMap[d.name] || d.name,
    score: Math.round(d.decayedScore * 100),
    fullMark: 100,
  }));

  if (data.length < 2) return null;

  return (
    <div role="img" aria-label={`Reputation radar: ${data.map((d) => `${d.dimension} ${d.score}`).join(", ")}`}>
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="dimension" />
        <Radar
          dataKey="score"
          stroke="var(--accent)"
          fill="var(--accent)"
          fillOpacity={0.15}
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--accent)" }}
          animationDuration={800}
        />
      </RadarChart>
    </ResponsiveContainer>
    </div>
  );
}
