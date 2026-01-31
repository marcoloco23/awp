"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CycleDataPoint } from "@/lib/types";

interface Props {
  data: CycleDataPoint[];
}

export function CycleMetricsTimeline({ data }: Props) {
  if (data.length < 2) return null;

  const chartData = data.map((d) => ({
    cycle: `Cycle ${d.cycle}`,
    successRate: Math.round(d.successRate * 100),
    tokens: d.totalTokens,
    tasks: d.tasksAttempted,
    succeeded: d.tasksSucceeded,
    failed: d.tasksFailed,
  }));

  return (
    <div role="img" aria-label={`Cycle metrics: ${chartData.map((d) => `${d.cycle} ${d.successRate}%`).join(", ")}`}>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="cycleGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="cycle"
            tick={{ fill: "var(--text-muted)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
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
            formatter={(value: number, name: string) => {
              if (name === "successRate") return [`${value}%`, "Success Rate"];
              return [value, name];
            }}
          />
          <Area
            type="monotone"
            dataKey="successRate"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#cycleGradient)"
            dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
