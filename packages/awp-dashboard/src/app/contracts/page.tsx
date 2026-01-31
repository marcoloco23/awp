import { FileText } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { EmptyState } from "@/components/ui/EmptyState";
import { listContracts } from "@/lib/reader";

export default async function ContractsPage() {
  const contracts = await listContracts();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-headline text-[var(--text-primary)] mb-1">Delegation Contracts</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Work agreements between agents with evaluation criteria and auto-generated reputation signals
        </p>
      </div>

      {contracts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No contracts"
          description="Create one with: awp contract create <slug>"
        />
      ) : (
        <div className="space-y-3 stagger-children">
          {contracts.map((c) => (
            <Card key={c.slug} padding="md">
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{c.slug}</h3>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mb-2 line-clamp-2">
                    {c.description}
                  </p>
                  <div className="flex items-center gap-4 text-[10px] font-mono text-[var(--text-muted)]">
                    <span>delegate: @{c.delegateSlug}</span>
                    {c.deadline && (
                      <span>
                        due{" "}
                        {new Date(c.deadline).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                    <span>
                      created{" "}
                      {new Date(c.created).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
                {c.hasEvaluation && c.weightedScore !== undefined && (
                  <ScoreGauge score={c.weightedScore} size={56} label="score" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
