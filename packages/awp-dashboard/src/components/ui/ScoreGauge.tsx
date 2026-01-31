"use client";

import { motion } from "motion/react";

interface ScoreGaugeProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showValue?: boolean;
}

function scoreColor(score: number): string {
  if (score >= 0.7) return "var(--rep-high)";
  if (score >= 0.4) return "var(--rep-mid)";
  return "var(--rep-low)";
}

export function ScoreGauge({
  score,
  size = 72,
  strokeWidth = 5,
  label,
  showValue = true,
}: ScoreGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score);
  const color = scoreColor(score);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Score: ${(score * 100).toFixed(0)}%${label ? ` — ${label}` : ""}`}>
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={strokeWidth}
          />
          {/* Score arc — animated from 0 */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
          />
        </svg>
        {showValue && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.5 }}
          >
            <span
              className="font-mono text-sm font-semibold"
              style={{ color }}
            >
              {(score * 100).toFixed(0)}
            </span>
          </motion.div>
        )}
      </div>
      {label && (
        <span className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase">
          {label}
        </span>
      )}
    </div>
  );
}
