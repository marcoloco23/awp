"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface AgentData {
  id: string;
  name: string;
  color: string;
  dimensions: Record<string, number>;
}

interface Props {
  agents: AgentData[];
}

const labelMap: Record<string, string> = {
  reliability: "Reliability",
  "epistemic-hygiene": "Epistemic",
  coordination: "Coordination",
};

export function AgentComparisonRadar({ agents }: Props) {
  if (agents.length === 0) return null;

  const allDimensions = new Set<string>();
  agents.forEach((a) => Object.keys(a.dimensions).forEach((d) => allDimensions.add(d)));

  const data = [...allDimensions].map((dim) => {
    const point: Record<string, unknown> = {
      dimension: labelMap[dim] || dim,
    };
    agents.forEach((a) => {
      point[a.id] = Math.round((a.dimensions[dim] ?? 0) * 100);
    });
    return point;
  });

  const ariaDesc = agents
    .map((a) => `${a.name}: ${Object.entries(a.dimensions).map(([d, s]) => `${d} ${Math.round(s * 100)}`).join(", ")}`)
    .join("; ");

  return (
    <div role="img" aria-label={`Agent comparison: ${ariaDesc}`}>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
          {agents.map((agent) => (
            <Radar
              key={agent.id}
              dataKey={agent.id}
              name={agent.name}
              stroke={agent.color}
              fill={agent.color}
              fillOpacity={0.1}
              strokeWidth={2}
              animationDuration={800}
            />
          ))}
          <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
