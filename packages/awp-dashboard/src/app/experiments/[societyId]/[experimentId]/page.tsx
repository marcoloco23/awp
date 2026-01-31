import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Zap, Target, Clock, Cpu, CheckCircle, Hash } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { MetricCard } from "@/components/ui/MetricCard";
import {
  readExperiment,
  computeCycleDataPoints,
  computeReputationTimeline,
} from "@/lib/reader";
import { CycleMetricsTimeline } from "@/components/charts/CycleMetricsTimeline";
import { AgentReputationEvolution } from "@/components/charts/AgentReputationEvolution";
import { AgentComparisonRadar } from "@/components/charts/AgentComparisonRadar";
import { SuccessCriteriaGrid } from "@/components/charts/SuccessCriteriaGrid";
import { CycleSummaryTable } from "@/components/charts/CycleSummaryTable";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

const AGENT_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "#a78bfa",
  "#f472b6",
];

export default async function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ societyId: string; experimentId: string }>;
}) {
  const { societyId, experimentId } = await params;
  const experiment = await readExperiment(societyId, experimentId);
  if (!experiment) notFound();

  const cycleData = computeCycleDataPoints(experiment);
  const reputationTimeline = computeReputationTimeline(experiment);
  const { aggregateMetrics, successCriteriaResults, finalReputations } = experiment;

  const criteriaMetCount = successCriteriaResults.filter((c) => c.met).length;

  // Prepare agent data for radar — extract score from ReputationDimension objects
  const agentIds = Object.keys(finalReputations);
  const agentRadarData = agentIds.map((id, i) => {
    const dims: Record<string, number> = {};
    for (const [dim, val] of Object.entries(finalReputations[id].dimensions)) {
      dims[dim] = typeof val === "number" ? val : val.score;
    }
    return {
      id,
      name: finalReputations[id].agentName || id,
      color: AGENT_COLORS[i % AGENT_COLORS.length],
      dimensions: dims,
    };
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href={`/experiments/${societyId}`}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
      >
        <ArrowLeft size={12} /> {societyId}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-headline text-[var(--text-primary)]">Experiment Results</h1>
        <code className="text-xs font-mono text-[var(--text-muted)]">{experiment.experimentId}</code>
        <div className="flex items-center gap-4 mt-1 text-xs text-[var(--text-secondary)]">
          <span>
            {new Date(experiment.startedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
            {" → "}
            {new Date(experiment.endedAt).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span className="font-mono">{formatDuration(aggregateMetrics.totalDurationMs)} total</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard label="Tasks" value={aggregateMetrics.totalTasks} icon={Hash} index={0} />
        <MetricCard
          label="Success Rate"
          value={`${Math.round(aggregateMetrics.overallSuccessRate * 100)}%`}
          icon={Target}
          index={1}
          variant="accent"
        />
        <MetricCard
          label="Tokens"
          value={aggregateMetrics.totalTokens.toLocaleString()}
          icon={Cpu}
          index={2}
        />
        <MetricCard
          label="Duration"
          value={formatDuration(aggregateMetrics.totalDurationMs)}
          icon={Clock}
          index={3}
        />
        <MetricCard
          label="Avg Cycle"
          value={formatDuration(aggregateMetrics.avgCycleDurationMs)}
          icon={Zap}
          index={4}
        />
        <MetricCard
          label="Criteria Met"
          value={`${criteriaMetCount}/${successCriteriaResults.length}`}
          icon={CheckCircle}
          index={5}
        />
      </div>

      {/* Success Criteria */}
      {successCriteriaResults.length > 0 && (
        <Card hover={false} padding="lg">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Success Criteria</h3>
          <SuccessCriteriaGrid criteria={successCriteriaResults} />
        </Card>
      )}

      {/* Cycle Metrics Timeline */}
      {cycleData.length >= 2 && (
        <Card hover={false} padding="lg">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Success Rate Over Cycles</h3>
          <CycleMetricsTimeline data={cycleData} />
        </Card>
      )}

      {/* Agent Reputation Evolution */}
      {reputationTimeline.points.length >= 2 && (
        <Card hover={false} padding="lg">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Agent Reputation Evolution</h3>
          <AgentReputationEvolution timeline={reputationTimeline} />
        </Card>
      )}

      {/* Agent Comparison Radar */}
      {agentRadarData.length > 0 && (
        <Card hover={false} padding="lg">
          <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-2">Final Agent Comparison</h3>
          <AgentComparisonRadar agents={agentRadarData} />
        </Card>
      )}

      {/* Cycle Summary Table */}
      <Card hover={false} padding="lg">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
          Cycle Details ({experiment.totalCycles})
        </h3>
        <CycleSummaryTable cycles={experiment.cycles} />
      </Card>
    </div>
  );
}
