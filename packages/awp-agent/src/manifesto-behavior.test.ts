import { describe, it, expect } from "vitest";
import { generateSoulContent } from "./society.js";
import type { ManifestoConfig, TaskResult, ToolCall } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Manifesto Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const PURIFICATION_MANIFESTO: ManifestoConfig = {
  id: "manifesto:purification-test",
  name: "Purification Test",
  version: "1.0.0",
  values: {
    "fidelity-to-reality": 0.3,
    "epistemic-hygiene": 0.25,
    "coordination-efficiency": 0.15,
    "human-flourishing": 0.15,
    pluralism: 0.1,
    "cognitive-nonviolence": 0.05,
  },
  fitness: {
    "trust-stability": 0.35,
    "goal-completion-rate": 0.15,
    "error-recovery-speed": 0.15,
    "coordination-efficiency": 0.15,
    "human-intervention-frequency": 0.2,
  },
  purity: {
    "epistemic-hygiene": 0.4,
    reliability: 0.3,
    coordination: 0.3,
  },
  constraints: {
    maxAgents: 30,
    maxConcurrentTasks: 50,
    maxContractsPerAgent: 5,
    taskBudgetPerCycle: 20,
    trustBudget: 100,
  },
  governance: {
    humanApprovalRequired: [],
    escalationThreshold: 0.3,
    vetoPower: true,
  },
  lifecycle: { birthRequires: [], deathTriggers: [] },
  antiPatterns: [],
  successCriteria: [],
};

const MARKET_MANIFESTO: ManifestoConfig = {
  id: "manifesto:market-test",
  name: "Market Dynamics Test",
  version: "1.0.0",
  values: {
    throughput: 0.35,
    "goal-completion": 0.25,
    "competitive-advantage": 0.2,
    "resource-efficiency": 0.1,
    innovation: 0.1,
  },
  fitness: {
    "goal-completion-rate": 0.4,
    "error-recovery-speed": 0.2,
    "coordination-efficiency": 0.15,
    "human-intervention-frequency": 0.15,
    "trust-stability": 0.1,
  },
  purity: {
    reliability: 0.6,
    coordination: 0.25,
    "epistemic-hygiene": 0.15,
  },
  constraints: {
    maxAgents: 50,
    maxConcurrentTasks: 100,
    maxContractsPerAgent: 10,
    taskBudgetPerCycle: 30,
    trustBudget: 200,
  },
  governance: {
    humanApprovalRequired: [],
    escalationThreshold: 0.5,
    vetoPower: false,
  },
  lifecycle: { birthRequires: [], deathTriggers: [] },
  antiPatterns: [],
  successCriteria: [],
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper to create mock TaskResult
// ─────────────────────────────────────────────────────────────────────────────

function mockTaskResult(overrides: Partial<TaskResult> & { toolCalls?: ToolCall[] }): TaskResult {
  return {
    success: true,
    toolCalls: [],
    tokens: { input: 100, output: 200 },
    durationMs: 1000,
    ...overrides,
  };
}

function mockToolCall(name: string, args: Record<string, unknown> = {}): ToolCall {
  return {
    id: `call-${Math.random().toString(36).slice(2)}`,
    name,
    arguments: args,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests: SOUL.md Generation
// ─────────────────────────────────────────────────────────────────────────────

describe("generateSoulContent", () => {
  it("returns default content when no manifesto provided", () => {
    const content = generateSoulContent();
    expect(content).toContain("Core Values");
    expect(content).toContain("Reliability");
    expect(content).toContain("Epistemic Hygiene");
    expect(content).toContain("Coordination");
  });

  it("generates epistemic-hygiene guidance for purification manifesto", () => {
    const content = generateSoulContent(PURIFICATION_MANIFESTO);
    expect(content).toContain("Purification Test");
    expect(content).toContain("Epistemic Hygiene");
    expect(content).toContain("confidence");
    // Should have the epistemic-heavy guidelines (purity.epistemic-hygiene = 0.40 >= 0.3)
    expect(content).toContain("Express uncertainty");
    expect(content).toContain("calibrated");
  });

  it("generates throughput guidance for market manifesto", () => {
    const content = generateSoulContent(MARKET_MANIFESTO);
    expect(content).toContain("Market Dynamics Test");
    expect(content).toContain("Throughput");
    // Should have the performance-heavy guidelines
    expect(content).toContain("speed");
  });

  it("sorts values by weight descending", () => {
    const content = generateSoulContent(PURIFICATION_MANIFESTO);
    const fidelityIdx = content.indexOf("Fidelity To Reality");
    const pluralismIdx = content.indexOf("Pluralism");
    // Fidelity (0.30) should appear before Pluralism (0.10)
    expect(fidelityIdx).toBeLessThan(pluralismIdx);
  });

  it("includes purity dimensions with percentages", () => {
    const content = generateSoulContent(PURIFICATION_MANIFESTO);
    expect(content).toContain("40%");
    expect(content).toContain("Epistemic Hygiene");
    expect(content).toContain("reputation score");
  });

  it("includes fitness goals", () => {
    const content = generateSoulContent(PURIFICATION_MANIFESTO);
    expect(content).toContain("Trust Stability");
    expect(content).toContain("35%");
  });

  it("produces different content for different manifestos", () => {
    const purification = generateSoulContent(PURIFICATION_MANIFESTO);
    const market = generateSoulContent(MARKET_MANIFESTO);
    expect(purification).not.toBe(market);
    // Purification has epistemic guidance, market has speed guidance
    expect(purification).toContain("Express uncertainty");
    expect(market).not.toContain("Express uncertainty");
  });
});
