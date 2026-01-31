import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "./AnimatedNumber";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  detail?: string;
  variant?: "default" | "accent";
  index?: number;
}

export function MetricCard({ label, value, icon: Icon, detail, variant = "default", index = 0 }: MetricCardProps) {
  const isNumeric = typeof value === "number";

  return (
    <div
      className="card p-4 flex items-start gap-3.5 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
      aria-label={`${label}: ${value}${detail ? `, ${detail}` : ""}`}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
        style={{
          background: variant === "accent" ? "var(--accent-glow-strong)" : "var(--surface-2)",
        }}
      >
        <Icon
          size={18}
          className={variant === "accent" ? "text-[var(--accent)]" : "text-[var(--text-secondary)]"}
        />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-mono text-[var(--text-muted)] tracking-wider uppercase mb-0.5">
          {label}
        </div>
        <div className="text-2xl font-semibold tracking-tight text-[var(--text-primary)] font-[var(--font-mono)]" style={{ fontFamily: "var(--font-mono)" }}>
          {isNumeric ? <AnimatedNumber value={value} /> : value}
        </div>
        {detail && (
          <div className="text-xs text-[var(--text-secondary)] mt-0.5">{detail}</div>
        )}
      </div>
    </div>
  );
}
