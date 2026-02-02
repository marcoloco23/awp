"use client";

import { motion } from "motion/react";

interface MetricRow {
  metric: string;
  meanA: number;
  meanB: number;
  pValue: number;
  significant: boolean;
  effectSize: number;
  effectLabel: string;
}

interface Props {
  metrics: MetricRow[];
  labelA: string;
  labelB: string;
}

function formatNum(n: number): string {
  if (Math.abs(n) >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (Math.abs(n) >= 1) return n.toFixed(2);
  if (Math.abs(n) >= 0.01) return n.toFixed(3);
  return n.toExponential(2);
}

function pValueBadge(p: number, significant: boolean): string {
  if (significant && p < 0.001) return "***";
  if (significant && p < 0.01) return "**";
  if (significant && p < 0.05) return "*";
  return "ns";
}

function effectColor(label: string): string {
  switch (label) {
    case "large":
      return "var(--accent)";
    case "medium":
      return "var(--warning)";
    case "small":
      return "var(--info)";
    default:
      return "var(--text-muted)";
  }
}

export function StatisticalComparisonTable({ metrics, labelA, labelB }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)]">
            <th className="text-left py-2 px-3">Metric</th>
            <th className="text-right py-2 px-3">{labelA}</th>
            <th className="text-right py-2 px-3">{labelB}</th>
            <th className="text-right py-2 px-3">p-value</th>
            <th className="text-center py-2 px-3">Sig.</th>
            <th className="text-right py-2 px-3">Effect</th>
            <th className="text-center py-2 px-3">Winner</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((row, i) => {
            const winner =
              !row.significant
                ? "—"
                : row.metric === "Anti-Pattern Rate"
                  ? row.meanA < row.meanB
                    ? "A"
                    : "B"
                  : row.meanA > row.meanB
                    ? "A"
                    : "B";

            return (
              <motion.tr
                key={row.metric}
                className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-2)] transition-colors"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <td className="py-2.5 px-3 text-[var(--text-primary)] font-medium">
                  {row.metric}
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                  {formatNum(row.meanA)}
                </td>
                <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                  {formatNum(row.meanB)}
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span
                    className={
                      row.significant
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-muted)]"
                    }
                  >
                    {formatNum(row.pValue)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  <span
                    className={
                      row.significant
                        ? "text-[var(--accent)] font-bold"
                        : "text-[var(--text-muted)]"
                    }
                  >
                    {pValueBadge(row.pValue, row.significant)}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right">
                  <span style={{ color: effectColor(row.effectLabel) }}>
                    {row.effectLabel}
                  </span>
                  <span className="text-[var(--text-muted)] ml-1">
                    ({formatNum(row.effectSize)})
                  </span>
                </td>
                <td className="py-2.5 px-3 text-center">
                  {winner === "—" ? (
                    <span className="text-[var(--text-muted)]">—</span>
                  ) : (
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                        winner === "A"
                          ? "bg-[var(--accent-glow-strong)] text-[var(--accent)]"
                          : "bg-[var(--info-dim)] text-[var(--info)]"
                      }`}
                    >
                      {winner}
                    </span>
                  )}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
