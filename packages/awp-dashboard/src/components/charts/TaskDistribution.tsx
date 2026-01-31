"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { TaskSummary } from "@/lib/types";

interface Props {
  tasks: TaskSummary[];
}

const STATUS_CONFIG: { key: TaskSummary["status"]; label: string; color: string }[] = [
  { key: "pending", label: "Pending", color: "var(--text-muted)" },
  { key: "in-progress", label: "In Progress", color: "var(--accent)" },
  { key: "blocked", label: "Blocked", color: "var(--danger)" },
  { key: "review", label: "Review", color: "var(--warning)" },
  { key: "completed", label: "Completed", color: "var(--success)" },
];

export function TaskDistribution({ tasks }: Props) {
  const data = STATUS_CONFIG.map(({ key, label, color }) => ({
    name: label,
    count: tasks.filter((t) => t.status === key).length,
    color,
  })).filter((d) => d.count > 0);

  if (data.length === 0) return null;

  return (
    <div role="img" aria-label={`Task distribution: ${data.map((d) => `${d.name} ${d.count}`).join(", ")}`}>
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={80}
          tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          barSize={18}
          animationDuration={800}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}
