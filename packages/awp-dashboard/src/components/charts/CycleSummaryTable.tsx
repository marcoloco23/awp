"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { CycleResult } from "@/lib/types";

interface Props {
  cycles: CycleResult[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function CycleSummaryTable({ cycles }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (cycles.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-2 px-3 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider w-8" />
            <th className="text-left py-2 px-3 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Cycle</th>
            <th className="text-left py-2 px-3 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Tasks</th>
            <th className="text-left py-2 px-3 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Success</th>
            <th className="text-left py-2 px-3 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Tokens</th>
            <th className="text-left py-2 px-3 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Duration</th>
            <th className="text-left py-2 px-3 text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider">Rep Changes</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((cycle) => {
            const isExpanded = expanded === cycle.cycleNumber;
            return (
              <tr key={cycle.cycleNumber} className="group">
                <td colSpan={7} className="p-0">
                  <div
                    className="flex items-center cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : cycle.cycleNumber)}
                  >
                    <div className="py-2.5 px-3 w-8">
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-[var(--text-muted)]" />
                      ) : (
                        <ChevronRight size={14} className="text-[var(--text-muted)]" />
                      )}
                    </div>
                    <div className="py-2.5 px-3 font-mono text-[var(--text-primary)]">
                      {cycle.cycleNumber}
                    </div>
                    <div className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {cycle.metrics.tasksSucceeded}/{cycle.metrics.tasksAttempted}
                    </div>
                    <div className="py-2.5 px-3">
                      <Badge variant={cycle.metrics.successRate >= 0.7 ? "success" : cycle.metrics.successRate >= 0.4 ? "warning" : "danger"} size="sm">
                        {Math.round(cycle.metrics.successRate * 100)}%
                      </Badge>
                    </div>
                    <div className="py-2.5 px-3 font-mono text-xs text-[var(--text-secondary)]">
                      {cycle.metrics.totalTokens.toLocaleString()}
                    </div>
                    <div className="py-2.5 px-3 font-mono text-xs text-[var(--text-secondary)]">
                      {formatDuration(cycle.metrics.totalDurationMs)}
                    </div>
                    <div className="py-2.5 px-3 text-[var(--text-secondary)]">
                      {cycle.reputationChanges.length}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-6 pb-4 space-y-3 border-b border-[var(--border-subtle)]">
                      {/* Reputation changes */}
                      {cycle.reputationChanges.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                            Reputation Changes
                          </div>
                          <div className="space-y-1">
                            {cycle.reputationChanges.map((rc, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs">
                                <span className="font-mono text-[var(--text-secondary)] w-40 truncate">{rc.agentId}</span>
                                <span className="text-[var(--text-muted)] capitalize w-28">{rc.dimension}</span>
                                <span className="font-mono text-[var(--text-secondary)]">
                                  {(rc.oldScore * 100).toFixed(0)} → {(rc.newScore * 100).toFixed(0)}
                                </span>
                                <span className={`font-mono ${rc.delta > 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                                  {rc.delta > 0 ? "+" : ""}{(rc.delta * 100).toFixed(1)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Tasks executed */}
                      {cycle.tasksExecuted.length > 0 && (
                        <div>
                          <div className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
                            Tasks Executed
                          </div>
                          <div className="space-y-1">
                            {cycle.tasksExecuted.map((te, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs">
                                <span className="font-mono text-[var(--text-secondary)] w-40 truncate">{te.agentId}</span>
                                <Badge variant={te.result.success ? "success" : "danger"} size="sm">
                                  {te.result.success ? "pass" : "fail"}
                                </Badge>
                                <span className="font-mono text-[var(--text-muted)]">
                                  {(te.result.tokens.input + te.result.tokens.output).toLocaleString()} tokens
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
