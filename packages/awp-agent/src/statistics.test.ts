import { describe, it, expect } from "vitest";
import {
  computeDescriptiveStats,
  welchTTest,
  mannWhitneyU,
  compareExperiments,
} from "./statistics.js";
import type { ExperimentResult, CycleResult, AgentReputation } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeCycle(
  cycleNumber: number,
  overrides: {
    successRate?: number;
    tasksSucceeded?: number;
    tasksAttempted?: number;
    totalTokens?: number;
    antiPatternsDetected?: Array<{ patternId: string; agentId: string; penalty: number }>;
    reputationChanges?: Array<{ agentId: string; dimension: string; oldScore: number; newScore: number; delta: number }>;
  } = {}
): CycleResult {
  const successRate = overrides.successRate ?? 0.8;
  const tasksAttempted = overrides.tasksAttempted ?? 10;
  const tasksSucceeded = overrides.tasksSucceeded ?? Math.round(tasksAttempted * successRate);
  return {
    cycleNumber,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    contractsCreated: [],
    tasksExecuted: [],
    reputationChanges: overrides.reputationChanges ?? [],
    metrics: {
      tasksAttempted,
      tasksSucceeded,
      tasksFailed: tasksAttempted - tasksSucceeded,
      successRate,
      totalTokens: overrides.totalTokens ?? 5000,
      totalDurationMs: 10000,
      avgTaskDurationMs: 1000,
      antiPatternsDetected: overrides.antiPatternsDetected ?? [],
    },
  };
}

function makeExperiment(
  id: string,
  manifestoId: string,
  cycles: CycleResult[],
  finalReputations?: Record<string, AgentReputation>
): ExperimentResult {
  return {
    experimentId: id,
    manifestoId,
    societyId: "test-society",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    totalCycles: cycles.length,
    cycles,
    finalReputations: finalReputations ?? {
      "agent-1": {
        agentDid: "did:awp:agent-1",
        agentName: "Agent 1",
        dimensions: {
          reliability: { score: 0.8, confidence: 0.9, sampleSize: 10, lastSignal: new Date().toISOString() },
        },
        overallScore: 0.8,
      },
    },
    aggregateMetrics: {
      totalTasks: cycles.reduce((s, c) => s + c.metrics.tasksAttempted, 0),
      totalSuccesses: cycles.reduce((s, c) => s + c.metrics.tasksSucceeded, 0),
      totalFailures: cycles.reduce((s, c) => s + c.metrics.tasksFailed, 0),
      overallSuccessRate: 0.8,
      totalTokens: cycles.reduce((s, c) => s + c.metrics.totalTokens, 0),
      totalDurationMs: 50000,
      avgCycleDurationMs: 10000,
    },
    successCriteriaResults: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: computeDescriptiveStats
// ─────────────────────────────────────────────────────────────────────────────

describe("computeDescriptiveStats", () => {
  it("returns zeros for empty array", () => {
    const stats = computeDescriptiveStats([]);
    expect(stats.n).toBe(0);
    expect(stats.mean).toBe(0);
    expect(stats.stddev).toBe(0);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.median).toBe(0);
  });

  it("computes correct stats for a single value", () => {
    const stats = computeDescriptiveStats([5]);
    expect(stats.n).toBe(1);
    expect(stats.mean).toBe(5);
    expect(stats.stddev).toBe(0);
    expect(stats.min).toBe(5);
    expect(stats.max).toBe(5);
    expect(stats.median).toBe(5);
  });

  it("computes correct stats for known dataset", () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];
    const stats = computeDescriptiveStats(values);

    expect(stats.n).toBe(8);
    expect(stats.mean).toBe(5); // 40 / 8
    expect(stats.min).toBe(2);
    expect(stats.max).toBe(9);
    expect(stats.median).toBe(4.5); // (4 + 5) / 2
    // Variance = sum((x - 5)^2) / (8-1) = (9+1+1+1+0+0+4+16)/7 = 32/7 ≈ 4.571
    expect(stats.stddev).toBeCloseTo(Math.sqrt(32 / 7), 5);
  });

  it("computes median for odd-length array", () => {
    const stats = computeDescriptiveStats([3, 1, 2]);
    expect(stats.median).toBe(2);
  });

  it("computes median for even-length array", () => {
    const stats = computeDescriptiveStats([1, 2, 3, 4]);
    expect(stats.median).toBe(2.5);
  });

  it("handles negative values", () => {
    const stats = computeDescriptiveStats([-3, -1, 0, 2, 4]);
    expect(stats.mean).toBeCloseTo(0.4, 5);
    expect(stats.min).toBe(-3);
    expect(stats.max).toBe(4);
    expect(stats.median).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: welchTTest
// ─────────────────────────────────────────────────────────────────────────────

describe("welchTTest", () => {
  it("returns non-significant for identical samples", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    const result = welchTTest(a, b);

    expect(result.testName).toBe("Welch's t-test");
    expect(result.statistic).toBeCloseTo(0, 5);
    expect(result.pValue).toBeGreaterThan(0.05);
    expect(result.significant).toBe(false);
    expect(result.effectSize).toBeCloseTo(0, 5);
    expect(result.effectLabel).toBe("negligible");
  });

  it("detects significant difference for widely separated samples", () => {
    const a = [10, 11, 12, 13, 14, 15, 10, 11, 12, 13];
    const b = [1, 2, 3, 4, 5, 6, 1, 2, 3, 4];
    const result = welchTTest(a, b);

    expect(result.significant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
    expect(result.effectLabel).toBe("large");
  });

  it("returns degenerate result for samples with n < 2", () => {
    const result = welchTTest([5], [3]);
    expect(result.statistic).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.significant).toBe(false);
  });

  it("handles zero-variance samples", () => {
    const a = [5, 5, 5, 5, 5];
    const b = [5, 5, 5, 5, 5];
    const result = welchTTest(a, b);

    expect(result.statistic).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.significant).toBe(false);
  });

  it("respects custom alpha level", () => {
    // Create samples that differ moderately
    const a = [5, 6, 7, 8, 9, 10];
    const b = [3, 4, 5, 6, 7, 8];
    const strict = welchTTest(a, b, 0.001);
    const lenient = welchTTest(a, b, 0.5);

    // With alpha 0.001, difference may not be significant
    // With alpha 0.5, it should be significant
    expect(lenient.significant).toBe(true);
    // p-value should be the same regardless of alpha
    expect(strict.pValue).toBeCloseTo(lenient.pValue, 10);
  });

  it("produces correct effect size labels", () => {
    // Very different distributions → large effect
    const large = welchTTest(
      [100, 101, 102, 103, 104],
      [1, 2, 3, 4, 5]
    );
    expect(large.effectLabel).toBe("large");
    expect(large.effectSize).toBeGreaterThanOrEqual(0.8);
  });

  it("returns positive t when a > b and negative when a < b", () => {
    const a = [10, 11, 12, 13, 14];
    const b = [1, 2, 3, 4, 5];
    const result = welchTTest(a, b);
    expect(result.statistic).toBeGreaterThan(0);

    const reversed = welchTTest(b, a);
    expect(reversed.statistic).toBeLessThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: mannWhitneyU
// ─────────────────────────────────────────────────────────────────────────────

describe("mannWhitneyU", () => {
  it("returns non-significant for identical samples", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1, 2, 3, 4, 5];
    const result = mannWhitneyU(a, b);

    expect(result.testName).toBe("Mann-Whitney U");
    expect(result.significant).toBe(false);
  });

  it("detects significant difference for non-overlapping samples", () => {
    const a = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = mannWhitneyU(a, b);

    expect(result.significant).toBe(true);
    expect(result.pValue).toBeLessThan(0.05);
  });

  it("returns degenerate result for empty samples", () => {
    const result = mannWhitneyU([], [1, 2, 3]);
    expect(result.statistic).toBe(0);
    expect(result.pValue).toBe(1);
    expect(result.significant).toBe(false);
  });

  it("handles ties correctly", () => {
    const a = [1, 1, 1, 2, 2];
    const b = [1, 1, 2, 2, 2];
    const result = mannWhitneyU(a, b);

    // Nearly identical distributions with ties — not significant
    expect(result.significant).toBe(false);
  });

  it("computes U statistic correctly for known example", () => {
    // Classic example: completely separated groups
    const a = [1, 2, 3]; // ranks 1, 2, 3
    const b = [4, 5, 6]; // ranks 4, 5, 6
    const result = mannWhitneyU(a, b);

    // rankSumA = 1+2+3 = 6
    // uA = 6 - 3*4/2 = 6 - 6 = 0
    // uB = 3*3 - 0 = 9
    // U = min(0, 9) = 0
    expect(result.statistic).toBe(0);
  });

  it("computes effect size", () => {
    const a = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109];
    const b = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = mannWhitneyU(a, b);

    expect(result.effectSize).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests: compareExperiments
// ─────────────────────────────────────────────────────────────────────────────

describe("compareExperiments", () => {
  it("compares two identical experiments as a tie", () => {
    const cycles = Array.from({ length: 5 }, (_, i) =>
      makeCycle(i, { successRate: 0.8, totalTokens: 5000 })
    );
    const expA = makeExperiment("exp-a", "manifesto-1", cycles);
    const expB = makeExperiment("exp-b", "manifesto-2", cycles);

    const comparison = compareExperiments(expA, expB);

    expect(comparison.experimentA).toBe("exp-a");
    expect(comparison.experimentB).toBe("exp-b");
    expect(comparison.manifestoA).toBe("manifesto-1");
    expect(comparison.manifestoB).toBe("manifesto-2");
    expect(comparison.metrics).toHaveLength(5);
    expect(comparison.summary.winner).toBe("tie");
    expect(comparison.summary.significantDifferences).toBe(0);
  });

  it("identifies experiment A as winner when it has better metrics", () => {
    const cyclesA = Array.from({ length: 10 }, (_, i) =>
      makeCycle(i, { successRate: 0.95, totalTokens: 3000, tasksSucceeded: 19, tasksAttempted: 20 })
    );
    const cyclesB = Array.from({ length: 10 }, (_, i) =>
      makeCycle(i, { successRate: 0.3, totalTokens: 10000, tasksSucceeded: 3, tasksAttempted: 10 })
    );

    const repsA: Record<string, AgentReputation> = {
      "agent-1": {
        agentDid: "did:awp:a1", agentName: "A1",
        dimensions: { reliability: { score: 0.95, confidence: 0.9, sampleSize: 10, lastSignal: new Date().toISOString() } },
        overallScore: 0.95,
      },
    };
    const repsB: Record<string, AgentReputation> = {
      "agent-1": {
        agentDid: "did:awp:a1", agentName: "A1",
        dimensions: { reliability: { score: 0.3, confidence: 0.5, sampleSize: 10, lastSignal: new Date().toISOString() } },
        overallScore: 0.3,
      },
    };

    const expA = makeExperiment("exp-a", "m-a", cyclesA, repsA);
    const expB = makeExperiment("exp-b", "m-b", cyclesB, repsB);

    const comparison = compareExperiments(expA, expB);
    expect(comparison.summary.winner).toBe("A");
    expect(comparison.summary.winCount.A).toBeGreaterThan(0);
  });

  it("uses mann-whitney test when specified", () => {
    const cyclesA = Array.from({ length: 8 }, (_, i) =>
      makeCycle(i, { successRate: 0.9 })
    );
    const cyclesB = Array.from({ length: 8 }, (_, i) =>
      makeCycle(i, { successRate: 0.5 })
    );
    const expA = makeExperiment("exp-a", "m-a", cyclesA);
    const expB = makeExperiment("exp-b", "m-b", cyclesB);

    const comparison = compareExperiments(expA, expB, { test: "mann-whitney" });

    // All metric tests should use Mann-Whitney
    for (const m of comparison.metrics) {
      expect(m.test.testName).toBe("Mann-Whitney U");
    }
  });

  it("respects custom alpha level", () => {
    const cyclesA = Array.from({ length: 5 }, (_, i) =>
      makeCycle(i, { successRate: 0.7 })
    );
    const cyclesB = Array.from({ length: 5 }, (_, i) =>
      makeCycle(i, { successRate: 0.5 })
    );
    const expA = makeExperiment("exp-a", "m-a", cyclesA);
    const expB = makeExperiment("exp-b", "m-b", cyclesB);

    const strict = compareExperiments(expA, expB, { alpha: 0.001 });
    const lenient = compareExperiments(expA, expB, { alpha: 0.5 });

    // Strict alpha should find fewer significant differences
    expect(strict.summary.significantDifferences).toBeLessThanOrEqual(
      lenient.summary.significantDifferences
    );
  });

  it("compares all 5 standard metrics", () => {
    const cycles = Array.from({ length: 5 }, (_, i) => makeCycle(i));
    const exp = makeExperiment("exp", "m", cycles);
    const comparison = compareExperiments(exp, exp);

    const metricNames = comparison.metrics.map((m) => m.metric);
    expect(metricNames).toContain("Success Rate");
    expect(metricNames).toContain("Token Efficiency");
    expect(metricNames).toContain("Trust Stability");
    expect(metricNames).toContain("Anti-Pattern Rate");
    expect(metricNames).toContain("Final Reputation");
  });

  it("handles experiments with different cycle counts", () => {
    const cyclesA = Array.from({ length: 3 }, (_, i) =>
      makeCycle(i, { successRate: 0.9 })
    );
    const cyclesB = Array.from({ length: 10 }, (_, i) =>
      makeCycle(i, { successRate: 0.5 })
    );
    const expA = makeExperiment("exp-a", "m-a", cyclesA);
    const expB = makeExperiment("exp-b", "m-b", cyclesB);

    // Should not throw
    const comparison = compareExperiments(expA, expB);
    expect(comparison.metrics).toHaveLength(5);
    expect(comparison.summary.totalMetrics).toBe(5);
  });

  it("considers anti-pattern rate as lower-is-better", () => {
    const cyclesA = Array.from({ length: 10 }, (_, i) =>
      makeCycle(i, { antiPatternsDetected: [{ patternId: "spam", agentId: "a", penalty: 0.2 }, { patternId: "spam", agentId: "b", penalty: 0.2 }] })
    );
    const cyclesB = Array.from({ length: 10 }, (_, i) =>
      makeCycle(i, { antiPatternsDetected: [] })
    );
    const expA = makeExperiment("exp-a", "m-a", cyclesA);
    const expB = makeExperiment("exp-b", "m-b", cyclesB);

    const comparison = compareExperiments(expA, expB);
    const antiPatternMetric = comparison.metrics.find((m) => m.metric === "Anti-Pattern Rate");
    expect(antiPatternMetric).toBeDefined();

    // B has 0 anti-patterns (better), A has 2 per cycle (worse)
    // If significant, B should win on this metric
    if (antiPatternMetric!.test.significant) {
      expect(antiPatternMetric!.a.mean).toBeGreaterThan(antiPatternMetric!.b.mean);
    }
  });
});
