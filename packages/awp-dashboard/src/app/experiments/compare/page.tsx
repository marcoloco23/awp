import Link from "next/link";
import { ArrowLeft, FlaskConical, Target, Cpu, Zap, Trophy, BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { MetricCard } from "@/components/ui/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { readExperimentComparison } from "@/lib/reader";
import { compareExperiments } from "@agent-workspace/agent";
import { StatisticalComparisonTable } from "@/components/charts/StatisticalComparisonTable";

export const metadata = { title: "Compare Experiments — AWP Dashboard" };

export default async function ExperimentComparePage({
  searchParams,
}: {
  searchParams: Promise<{
    societyA?: string;
    expA?: string;
    societyB?: string;
    expB?: string;
    test?: string;
  }>;
}) {
  const params = await searchParams;
  const { societyA, expA, societyB, expB, test } = params;

  // Validate required params
  if (!societyA || !expA || !societyB || !expB) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Link
          href="/experiments"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={12} /> Experiments
        </Link>
        <EmptyState
          icon={BarChart3}
          title="Select two experiments to compare"
          description="Use query params: ?societyA=...&expA=...&societyB=...&expB=..."
        />
      </div>
    );
  }

  const data = await readExperimentComparison(societyA, expA, societyB, expB);

  if (!data) {
    return (
      <div className="space-y-6 max-w-5xl">
        <Link
          href="/experiments"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
        >
          <ArrowLeft size={12} /> Experiments
        </Link>
        <EmptyState
          icon={FlaskConical}
          title="Experiments not found"
          description="One or both experiments could not be loaded. Check that the IDs are correct."
        />
      </div>
    );
  }

  const testType = test === "mann-whitney" ? "mann-whitney" as const : "t-test" as const;
  const comparison = compareExperiments(data.expA, data.expB, { test: testType });
  const { summary, metrics } = comparison;

  const tableRows = metrics.map((m) => ({
    metric: m.metric,
    meanA: m.a.mean,
    meanB: m.b.mean,
    pValue: m.test.pValue,
    significant: m.test.significant,
    effectSize: m.test.effectSize,
    effectLabel: m.test.effectLabel,
  }));

  const winnerLabel =
    summary.winner === "tie"
      ? "Tie"
      : summary.winner === "A"
        ? comparison.experimentA
        : comparison.experimentB;

  const winnerVariant: "success" | "info" | "muted" =
    summary.winner === "tie" ? "muted" : "success";

  return (
    <div className="space-y-6 max-w-5xl">
      <Link
        href="/experiments"
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
      >
        <ArrowLeft size={12} /> Experiments
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-headline text-[var(--text-primary)]">Statistical Comparison</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {comparison.manifestoA} vs {comparison.manifestoB}
        </p>
      </div>

      {/* Experiment labels */}
      <div className="grid grid-cols-2 gap-4">
        <Card hover={false} padding="sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--accent-glow-strong)] text-[var(--accent)] text-xs font-bold">
              A
            </span>
            <div className="min-w-0 flex-1">
              <code className="text-xs font-mono text-[var(--text-primary)] truncate block">
                {comparison.experimentA}
              </code>
              <span className="text-[10px] text-[var(--text-muted)]">
                {data.expA.totalCycles} cycles &middot; {data.expA.aggregateMetrics.totalTasks} tasks
              </span>
            </div>
          </div>
        </Card>
        <Card hover={false} padding="sm">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--info-dim)] text-[var(--info)] text-xs font-bold">
              B
            </span>
            <div className="min-w-0 flex-1">
              <code className="text-xs font-mono text-[var(--text-primary)] truncate block">
                {comparison.experimentB}
              </code>
              <span className="text-[10px] text-[var(--text-muted)]">
                {data.expB.totalCycles} cycles &middot; {data.expB.aggregateMetrics.totalTasks} tasks
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Winner"
          value={summary.winner === "tie" ? "Tie" : summary.winner}
          icon={Trophy}
          index={0}
          variant="accent"
        />
        <MetricCard
          label="Sig. Differences"
          value={`${summary.significantDifferences}/${summary.totalMetrics}`}
          icon={BarChart3}
          index={1}
        />
        <MetricCard
          label="A Wins"
          value={summary.winCount.A}
          icon={Target}
          index={2}
        />
        <MetricCard
          label="B Wins"
          value={summary.winCount.B}
          icon={Target}
          index={3}
        />
      </div>

      {/* Test info */}
      <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <Badge variant="info" size="sm">
          {testType === "mann-whitney" ? "Mann-Whitney U" : "Welch's t-test"}
        </Badge>
        <span>&alpha; = 0.05</span>
        <span>&middot;</span>
        <span>* p &lt; 0.05 &nbsp; ** p &lt; 0.01 &nbsp; *** p &lt; 0.001</span>
      </div>

      {/* Statistical Comparison Table */}
      <Card hover={false} padding="lg">
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">
          Metric-by-Metric Comparison
        </h3>
        <StatisticalComparisonTable
          metrics={tableRows}
          labelA="A (mean)"
          labelB="B (mean)"
        />
      </Card>

      {/* Per-metric detail cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <Card key={m.metric} hover={false} padding="md">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-primary)]">{m.metric}</span>
                {m.test.significant ? (
                  <Badge variant="success" size="sm">significant</Badge>
                ) : (
                  <Badge variant="muted" size="sm">ns</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-[var(--surface-2)] p-2">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">A</div>
                  <div className="text-sm font-mono text-[var(--text-primary)]">
                    {m.a.mean.toFixed(3)}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    &plusmn;{m.a.stddev.toFixed(3)} (n={m.a.n})
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--surface-2)] p-2">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase">B</div>
                  <div className="text-sm font-mono text-[var(--text-primary)]">
                    {m.b.mean.toFixed(3)}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    &plusmn;{m.b.stddev.toFixed(3)} (n={m.b.n})
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
                <span>p = {m.test.pValue.toFixed(4)}</span>
                <span>
                  d = {m.test.effectSize.toFixed(2)} ({m.test.effectLabel})
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
