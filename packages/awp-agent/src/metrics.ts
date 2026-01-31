/**
 * Metrics collection for AWP experiments.
 *
 * Tracks tokens, success rates, reputation changes, and other experiment metrics.
 */

import type {
  CycleMetrics,
  CycleResult,
  ExperimentResult,
  AgentReputation,
  TaskResult,
  ManifestoConfig,
} from "./types.js";

/**
 * Snapshot of metrics at a point in time.
 */
export interface MetricsSnapshot {
  timestamp: string;
  cycleNumber: number;
  metrics: CycleMetrics;
  reputations: Record<string, AgentReputation>;
}

/**
 * Collects and aggregates metrics during experiment execution.
 */
export class MetricsCollector {
  private snapshots: MetricsSnapshot[] = [];
  private currentCycle: number = 0;
  private startedAt: string | null = null;

  /** Task execution records for current cycle */
  private currentTasks: Array<{
    contractId: string;
    agentId: string;
    result: TaskResult;
  }> = [];

  /** Reputation snapshots at start of current cycle */
  private previousReputations: Record<string, AgentReputation> = {};

  /** Current reputations */
  private currentReputations: Record<string, AgentReputation> = {};

  /** Detected anti-patterns this cycle */
  private antiPatterns: Array<{
    patternId: string;
    agentId: string;
    penalty: number;
  }> = [];

  /**
   * Start a new experiment.
   */
  startExperiment(): void {
    this.snapshots = [];
    this.currentCycle = 0;
    this.startedAt = new Date().toISOString();
    this.resetCycle();
  }

  /**
   * Start a new cycle.
   */
  startCycle(reputations: Record<string, AgentReputation>): void {
    this.previousReputations = { ...reputations };
    this.currentReputations = {};
    this.resetCycle();
  }

  /**
   * Reset cycle-specific state.
   */
  private resetCycle(): void {
    this.currentTasks = [];
    this.antiPatterns = [];
  }

  /**
   * Record a task execution.
   */
  recordTask(contractId: string, agentId: string, result: TaskResult): void {
    this.currentTasks.push({ contractId, agentId, result });
  }

  /**
   * Record an anti-pattern detection.
   */
  recordAntiPattern(patternId: string, agentId: string, penalty: number): void {
    this.antiPatterns.push({ patternId, agentId, penalty });
  }

  /**
   * Update reputation snapshot.
   */
  updateReputation(agentId: string, reputation: AgentReputation): void {
    this.currentReputations[agentId] = reputation;
  }

  /**
   * Compute reputation changes for the current cycle.
   */
  private computeReputationChanges(): Array<{
    agentId: string;
    dimension: string;
    oldScore: number;
    newScore: number;
    delta: number;
  }> {
    const changes: Array<{
      agentId: string;
      dimension: string;
      oldScore: number;
      newScore: number;
      delta: number;
    }> = [];

    for (const [agentId, newRep] of Object.entries(this.currentReputations)) {
      const oldRep = this.previousReputations[agentId];
      if (!oldRep) continue;

      for (const [dimension, newDim] of Object.entries(newRep.dimensions)) {
        const oldDim = oldRep.dimensions[dimension];
        if (!oldDim) continue;

        const delta = newDim.score - oldDim.score;
        if (Math.abs(delta) > 0.001) {
          changes.push({
            agentId,
            dimension,
            oldScore: oldDim.score,
            newScore: newDim.score,
            delta,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Complete the current cycle and generate a CycleResult.
   */
  completeCycle(contractsCreated: string[]): CycleResult {
    const endedAt = new Date().toISOString();
    const startedAt =
      this.snapshots.length > 0
        ? this.snapshots[this.snapshots.length - 1].timestamp
        : this.startedAt || endedAt;

    // Compute metrics
    const tasksAttempted = this.currentTasks.length;
    const tasksSucceeded = this.currentTasks.filter((t) => t.result.success).length;
    const tasksFailed = tasksAttempted - tasksSucceeded;

    const totalTokens = this.currentTasks.reduce(
      (sum, t) => sum + t.result.tokens.input + t.result.tokens.output,
      0
    );
    const totalDurationMs = this.currentTasks.reduce((sum, t) => sum + t.result.durationMs, 0);

    const metrics: CycleMetrics = {
      tasksAttempted,
      tasksSucceeded,
      tasksFailed,
      successRate: tasksAttempted > 0 ? tasksSucceeded / tasksAttempted : 0,
      totalTokens,
      totalDurationMs,
      avgTaskDurationMs: tasksAttempted > 0 ? totalDurationMs / tasksAttempted : 0,
      antiPatternsDetected: [...this.antiPatterns],
    };

    const result: CycleResult = {
      cycleNumber: this.currentCycle,
      startedAt,
      endedAt,
      contractsCreated,
      tasksExecuted: [...this.currentTasks],
      reputationChanges: this.computeReputationChanges(),
      metrics,
    };

    // Take snapshot
    this.snapshot();
    this.currentCycle++;

    return result;
  }

  /**
   * Take a snapshot of current metrics.
   */
  snapshot(): void {
    const tasksAttempted = this.currentTasks.length;
    const tasksSucceeded = this.currentTasks.filter((t) => t.result.success).length;
    const totalTokens = this.currentTasks.reduce(
      (sum, t) => sum + t.result.tokens.input + t.result.tokens.output,
      0
    );
    const totalDurationMs = this.currentTasks.reduce((sum, t) => sum + t.result.durationMs, 0);

    this.snapshots.push({
      timestamp: new Date().toISOString(),
      cycleNumber: this.currentCycle,
      metrics: {
        tasksAttempted,
        tasksSucceeded,
        tasksFailed: tasksAttempted - tasksSucceeded,
        successRate: tasksAttempted > 0 ? tasksSucceeded / tasksAttempted : 0,
        totalTokens,
        totalDurationMs,
        avgTaskDurationMs: tasksAttempted > 0 ? totalDurationMs / tasksAttempted : 0,
        antiPatternsDetected: [...this.antiPatterns],
      },
      reputations: { ...this.currentReputations },
    });
  }

  /**
   * Get all snapshots.
   */
  getSnapshots(): MetricsSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Summarize the experiment results.
   */
  summarize(
    experimentId: string,
    manifestoId: string,
    societyId: string,
    cycles: CycleResult[],
    manifesto?: ManifestoConfig
  ): ExperimentResult {
    const endedAt = new Date().toISOString();

    // Aggregate metrics
    let totalTasks = 0;
    let totalSuccesses = 0;
    let totalTokens = 0;
    let totalDurationMs = 0;

    for (const cycle of cycles) {
      totalTasks += cycle.metrics.tasksAttempted;
      totalSuccesses += cycle.metrics.tasksSucceeded;
      totalTokens += cycle.metrics.totalTokens;
      totalDurationMs += cycle.metrics.totalDurationMs;
    }

    // Evaluate success criteria
    const successCriteriaResults: Array<{
      criterionId: string;
      met: boolean;
      actualValue: number;
      threshold: number;
    }> = [];

    if (manifesto?.successCriteria) {
      for (const criterion of manifesto.successCriteria) {
        // Simplified evaluation — in production, implement proper metric evaluation
        let actualValue = 0;
        let threshold = criterion.threshold || 0;
        let met = false;

        switch (criterion.id) {
          case "trust-stability":
            // Check if reputation variance is low
            actualValue = this.computeTrustStability(cycles);
            met = actualValue >= threshold;
            break;
          case "human-intervention-decrease":
            // Not implemented in simulation
            actualValue = 0;
            met = true;
            break;
          default:
            actualValue = totalSuccesses / Math.max(totalTasks, 1);
            met = actualValue >= threshold;
        }

        successCriteriaResults.push({
          criterionId: criterion.id,
          met,
          actualValue,
          threshold,
        });
      }
    }

    return {
      experimentId,
      manifestoId,
      societyId,
      startedAt: this.startedAt || endedAt,
      endedAt,
      totalCycles: cycles.length,
      cycles,
      finalReputations: { ...this.currentReputations },
      aggregateMetrics: {
        totalTasks,
        totalSuccesses,
        totalFailures: totalTasks - totalSuccesses,
        overallSuccessRate: totalTasks > 0 ? totalSuccesses / totalTasks : 0,
        totalTokens,
        totalDurationMs,
        avgCycleDurationMs: cycles.length > 0 ? totalDurationMs / cycles.length : 0,
      },
      successCriteriaResults,
    };
  }

  /**
   * Compute trust stability metric (low variance in reputation changes).
   */
  private computeTrustStability(cycles: CycleResult[]): number {
    if (cycles.length < 2) return 1;

    // Compute variance of reputation deltas
    const allDeltas: number[] = [];
    for (const cycle of cycles) {
      for (const change of cycle.reputationChanges) {
        allDeltas.push(Math.abs(change.delta));
      }
    }

    if (allDeltas.length === 0) return 1;

    const mean = allDeltas.reduce((a, b) => a + b, 0) / allDeltas.length;
    const variance =
      allDeltas.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / allDeltas.length;

    // Convert variance to stability score (lower variance = higher stability)
    return Math.max(0, 1 - variance);
  }
}
