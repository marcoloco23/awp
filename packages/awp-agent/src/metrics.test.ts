import { describe, it, expect } from "vitest";
import { MetricsCollector } from "./metrics.js";
import type { AgentReputation, TaskResult } from "./types.js";

const baseRep = (score: number): AgentReputation => ({
  agentDid: "did:awp:test",
  agentName: "Test",
  dimensions: {
    reliability: {
      score,
      confidence: 0.5,
      sampleSize: 5,
      lastSignal: new Date().toISOString(),
    },
  },
  overallScore: score,
});

const successTask = (_tokens = 200, durationMs = 1000): TaskResult => ({
  success: true,
  toolCalls: [],
  tokens: { input: 100, output: 100 },
  durationMs,
});

const failedTask = (): TaskResult => ({
  ...successTask(),
  success: false,
  error: "boom",
});

describe("MetricsCollector lifecycle", () => {
  it("aggregates tasks across a cycle", () => {
    const c = new MetricsCollector();
    c.startExperiment();
    c.startCycle({ a: baseRep(0.5) });

    c.recordTask("contract:1", "a", successTask());
    c.recordTask("contract:2", "a", failedTask());
    c.recordTask("contract:3", "a", successTask());

    const cycle = c.completeCycle(["contract:1", "contract:2", "contract:3"]);

    expect(cycle.metrics.tasksAttempted).toBe(3);
    expect(cycle.metrics.tasksSucceeded).toBe(2);
    expect(cycle.metrics.tasksFailed).toBe(1);
    expect(cycle.metrics.successRate).toBeCloseTo(2 / 3);
    expect(cycle.metrics.totalTokens).toBe(600);
    expect(cycle.contractsCreated).toHaveLength(3);
  });

  it("computes reputation changes between snapshots", () => {
    const c = new MetricsCollector();
    c.startExperiment();
    c.startCycle({ a: baseRep(0.5) });
    c.updateReputation("a", baseRep(0.7));
    const cycle = c.completeCycle([]);
    const change = cycle.reputationChanges.find((r) => r.dimension === "reliability");
    expect(change?.oldScore).toBeCloseTo(0.5);
    expect(change?.newScore).toBeCloseTo(0.7);
    expect(change?.delta).toBeCloseTo(0.2);
  });

  it("returns zero metrics when no tasks recorded", () => {
    const c = new MetricsCollector();
    c.startExperiment();
    c.startCycle({});
    const cycle = c.completeCycle([]);
    expect(cycle.metrics.tasksAttempted).toBe(0);
    expect(cycle.metrics.successRate).toBe(0);
  });

  it("records anti-patterns", () => {
    const c = new MetricsCollector();
    c.startExperiment();
    c.startCycle({});
    c.recordAntiPattern("over-confidence", "a", 0.1);
    const cycle = c.completeCycle([]);
    expect(cycle.metrics.antiPatternsDetected).toHaveLength(1);
    expect(cycle.metrics.antiPatternsDetected[0].patternId).toBe("over-confidence");
  });

  it("getSnapshots() returns a copy of all snapshots taken", () => {
    const c = new MetricsCollector();
    c.startExperiment();
    c.startCycle({});
    c.recordTask("c", "a", successTask());
    c.completeCycle(["c"]);
    expect(c.getSnapshots()).toHaveLength(1);
  });

  it("summarize aggregates across multiple cycles", () => {
    const c = new MetricsCollector();
    c.startExperiment();
    c.startCycle({});
    c.recordTask("c1", "a", successTask());
    const cycle1 = c.completeCycle(["c1"]);

    c.startCycle({});
    c.recordTask("c2", "a", failedTask());
    const cycle2 = c.completeCycle(["c2"]);

    const summary = c.summarize("exp:1", "manifesto:base", "society:1", [cycle1, cycle2]);
    expect(summary.experimentId).toBe("exp:1");
    expect(summary.aggregateMetrics.totalTasks).toBe(2);
    expect(summary.aggregateMetrics.totalSuccesses).toBe(1);
  });
});
