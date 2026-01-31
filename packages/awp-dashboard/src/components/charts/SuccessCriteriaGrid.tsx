"use client";

import { Badge } from "@/components/ui/Badge";

interface Criterion {
  criterionId: string;
  met: boolean;
  actualValue: number;
  threshold: number;
}

interface Props {
  criteria: Criterion[];
}

export function SuccessCriteriaGrid({ criteria }: Props) {
  if (criteria.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {criteria.map((c) => {
        const pct = Math.min(100, Math.round((c.actualValue / Math.max(c.threshold, 0.01)) * 100));
        return (
          <div
            key={c.criterionId}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--text-primary)] capitalize">
                {c.criterionId.replace(/-/g, " ")}
              </span>
              <Badge variant={c.met ? "success" : "danger"} size="sm">
                {c.met ? "met" : "not met"}
              </Badge>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--surface-1)] overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: c.met ? "var(--success)" : "var(--danger)",
                }}
              />
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)]">
              {c.actualValue.toFixed(2)} / {c.threshold.toFixed(2)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
