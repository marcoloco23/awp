"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { ReputationTimelineData } from "@/lib/types";

interface Props {
  timeline: ReputationTimelineData;
}

export function AgentReputationEvolution({ timeline }: Props) {
  if (timeline.points.length < 2) return null;

  return (
    <div role="img" aria-label="Agent reputation evolution over cycles">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={timeline.points} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <XAxis
            dataKey="cycle"
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            label={{ value: "Cycle", position: "insideBottomRight", offset: -4, fill: "var(--text-muted)", fontSize: 10 }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-1)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              color: "var(--text-primary)",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)" }}
          />
          {timeline.agents.map((agent) => (
            <Line
              key={agent.id}
              dataKey={agent.id}
              name={agent.name}
              stroke={agent.color}
              strokeWidth={2}
              dot={{ r: 3, fill: agent.color, strokeWidth: 0 }}
              animationDuration={800}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
