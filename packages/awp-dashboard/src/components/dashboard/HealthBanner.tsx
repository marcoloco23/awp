import { AlertTriangle } from "lucide-react";
import type { WorkspaceHealth } from "@/lib/types";

export function HealthBanner({ health }: { health: WorkspaceHealth }) {
  if (health.ok) return null;

  return (
    <div className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-dim)] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={18} className="text-[var(--warning)] mt-0.5 shrink-0" />
        <div>
          <div className="text-sm font-medium text-[var(--warning)] mb-1">
            {health.warnings.length} health warning{health.warnings.length !== 1 ? "s" : ""}
          </div>
          <ul className="space-y-0.5">
            {health.warnings.map((w, i) => (
              <li key={i} className="text-xs text-[var(--text-secondary)]">
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
