import Link from "next/link";
import { Shield } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { EmptyState } from "@/components/ui/EmptyState";
import { listReputationProfiles } from "@/lib/reader";

export default async function ReputationPage() {
  const profiles = await listReputationProfiles();

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-headline text-[var(--text-primary)] mb-1">Reputation</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Agent reputation profiles with multi-dimensional scoring and time-based decay
        </p>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No reputation profiles"
          description="Signal an agent with: awp reputation signal <slug> --dimension reliability --score 0.9"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {profiles.map((p) => {
            const avgScore =
              p.dimensions.length > 0
                ? p.dimensions.reduce((sum, d) => sum + d.decayedScore, 0) / p.dimensions.length
                : 0;

            return (
              <Link key={p.slug} href={`/reputation/${p.slug}`}>
                <Card padding="lg" className="h-full">
                  <div className="flex items-start gap-4">
                    <ScoreGauge score={avgScore} size={60} label="" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">
                        {p.agentName}
                      </h3>
                      <span className="text-[10px] font-mono text-[var(--text-muted)] block mb-2">
                        @{p.slug}
                      </span>
                      <div className="space-y-1.5">
                        {p.dimensions.map((d) => (
                          <div key={d.name} className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[var(--text-secondary)] w-20 truncate">
                              {d.name}
                            </span>
                            <div className="flex-1 h-1 rounded-full bg-[var(--surface-2)] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${d.decayedScore * 100}%`,
                                  background:
                                    d.decayedScore >= 0.7
                                      ? "var(--rep-high)"
                                      : d.decayedScore >= 0.4
                                        ? "var(--rep-mid)"
                                        : "var(--rep-low)",
                                }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-[var(--text-muted)] w-8 text-right">
                              {(d.decayedScore * 100).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {p.signalCount} signals
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {p.domainCount} domains
                    </span>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
