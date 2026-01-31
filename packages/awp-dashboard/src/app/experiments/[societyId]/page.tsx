import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, Zap, FlaskConical, Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { readSocietyDetail } from "@/lib/reader";

export default async function SocietyDetailPage({
  params,
}: {
  params: Promise<{ societyId: string }>;
}) {
  const { societyId } = await params;
  const detail = await readSocietyDetail(societyId);
  if (!detail) notFound();

  const { config, agents, experiments } = detail;
  const latestExp = experiments[0];

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/experiments"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
      >
        <ArrowLeft size={12} /> Experiments
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
          <FlaskConical size={20} className="text-[var(--accent)]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-headline text-[var(--text-primary)] truncate">{config.id}</h1>
            <StatusBadge status={config.status} />
          </div>
          <code className="text-xs font-mono text-[var(--text-muted)]">{config.manifestoId}</code>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Cycles" value={config.currentCycle} icon={Zap} index={0} />
        <MetricCard label="Experiments" value={experiments.length} icon={FlaskConical} index={1} />
        <MetricCard label="Agents" value={agents.length} icon={Users} index={2} />
        <MetricCard
          label="Success Rate"
          value={latestExp ? `${Math.round(latestExp.overallSuccessRate * 100)}%` : "—"}
          icon={Target}
          index={3}
          variant="accent"
        />
      </div>

      {/* Agents */}
      <Card hover={false} padding="lg">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Agents</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--surface-1)] border border-[var(--border)] flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                  {agent.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text-primary)]">{agent.name}</div>
                  <code className="text-[10px] font-mono text-[var(--text-muted)] truncate block">
                    {agent.did || agent.id}
                  </code>
                </div>
              </div>
              {agent.reputation && (
                <div className="flex items-center gap-3">
                  <ScoreGauge score={agent.reputation.overallScore} size={48} showValue />
                  <div className="space-y-1">
                    {Object.entries(agent.reputation.dimensions).map(([dim, val]) => {
                      const score = typeof val === "number" ? val : val.score;
                      return (
                        <div key={dim} className="flex items-center gap-2 text-[10px]">
                          <span className="text-[var(--text-muted)] capitalize w-20 truncate">
                            {dim.replace(/-/g, " ")}
                          </span>
                          <div className="w-16 h-1 rounded-full bg-[var(--surface-1)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[var(--accent)]"
                              style={{ width: `${Math.round(score * 100)}%` }}
                            />
                          </div>
                          <span className="font-mono text-[var(--text-secondary)]">
                            {Math.round(score * 100)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Experiments */}
      <Card hover={false} padding="lg">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
          Experiment Runs ({experiments.length})
        </h3>
        {experiments.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No experiments run yet.</p>
        ) : (
          <div className="space-y-2">
            {experiments.map((exp) => (
              <Link
                key={exp.experimentId}
                href={`/experiments/${societyId}/${exp.experimentId}`}
                className="block"
              >
                <div className="flex items-center gap-4 p-3 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-2)]/80 transition-colors">
                  <div className="flex-1 min-w-0">
                    <code className="text-xs font-mono text-[var(--text-primary)] truncate block">
                      {exp.experimentId}
                    </code>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(exp.startedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <Badge variant={exp.overallSuccessRate >= 0.7 ? "success" : exp.overallSuccessRate >= 0.4 ? "warning" : "danger"} size="sm">
                      {Math.round(exp.overallSuccessRate * 100)}%
                    </Badge>
                    <span className="text-[var(--text-muted)] font-mono">
                      {exp.totalCycles} cycle{exp.totalCycles > 1 ? "s" : ""}
                    </span>
                    <span className="text-[var(--text-muted)] font-mono">
                      {exp.totalTasks} tasks
                    </span>
                    <Badge variant="info" size="sm">
                      {exp.criteriaMetCount}/{exp.criteriaTotalCount} criteria
                    </Badge>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
