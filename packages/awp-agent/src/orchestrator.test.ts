import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { ExperimentOrchestrator } from "./orchestrator.js";
import { MetricsCollector } from "./metrics.js";
import type {
  AgentAdapter,
  AgentTask,
  TaskResult,
  AgentReputation,
  ManifestoConfig,
  SocietyConfig,
} from "./types.js";

class FakeAgent implements AgentAdapter {
  constructor(
    public readonly id: string,
    public readonly workspace: string,
    public readonly did: string,
  ) {}

  async getIdentity() {
    return { name: this.id, did: this.did };
  }

  async getReputation(): Promise<AgentReputation> {
    const now = new Date().toISOString();
    return {
      agentDid: this.did,
      agentName: this.id,
      dimensions: {
        reliability: { score: 0.7, confidence: 0.3, sampleSize: 3, lastSignal: now },
      },
      overallScore: 0.7,
    };
  }

  async executeTask(task: AgentTask): Promise<TaskResult> {
    return {
      success: true,
      output: `done ${task.contractId}`,
      toolCalls: [
        {
          id: "tc",
          name: "task_complete",
          arguments: { summary: "done" },
        },
      ],
      tokens: { input: 100, output: 50 },
      durationMs: 10,
    };
  }
}

async function makeAgentWorkspace(did: string): Promise<string> {
  const dir = join(tmpdir(), `awp-orch-${Date.now()}-${Math.random().toString(36).slice(2)}-${did.slice(-3)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: did,
      id: `urn:awp:workspace:${did}`,
      agent: { did, identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("\n# Bot\n", { awp: "1.0.0", type: "identity", name: did, did }),
  );
  await mkdir(join(dir, "contracts"), { recursive: true });
  await mkdir(join(dir, "reputation"), { recursive: true });
  return dir;
}

const manifesto: ManifestoConfig = {
  id: "manifesto:test",
  name: "Test Manifesto",
  version: "1.0.0",
  values: { reliability: 1.0 },
  fitness: { reliability: 1.0 },
  purity: { reliability: 0.7, "epistemic-hygiene": 0.2, coordination: 0.1 },
  constraints: {
    maxAgents: 10,
    maxConcurrentTasks: 5,
    maxContractsPerAgent: 5,
    taskBudgetPerCycle: 2,
    trustBudget: 10,
  },
  governance: { humanApprovalRequired: [], escalationThreshold: 0.3, vetoPower: false },
  lifecycle: { birthRequires: [], deathTriggers: [] },
  antiPatterns: [],
  successCriteria: [],
};

let wsA: string;
let wsB: string;
let society: SocietyConfig;
let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  wsA = await makeAgentWorkspace("did:awp:a");
  wsB = await makeAgentWorkspace("did:awp:b");
  society = {
    id: "society:test",
    manifestoId: "manifesto:test",
    path: join(tmpdir(), `awp-orch-soc-${Date.now()}`),
    createdAt: new Date().toISOString(),
    status: "active",
    agents: [wsA, wsB],
    currentCycle: 0,
    seed: 42,
  };
  await mkdir(society.path, { recursive: true });
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(async () => {
  logSpy.mockRestore();
  await rm(wsA, { recursive: true, force: true });
  await rm(wsB, { recursive: true, force: true });
  await rm(society.path, { recursive: true, force: true });
});

describe("ExperimentOrchestrator", () => {
  it("runCycle creates contracts and records task metrics", async () => {
    const agents = [new FakeAgent("a", wsA, "did:awp:a"), new FakeAgent("b", wsB, "did:awp:b")];
    const metrics = new MetricsCollector();
    metrics.startExperiment();
    const orch = new ExperimentOrchestrator(manifesto, agents, metrics, society, 42);

    const cycle = await orch.runCycle();
    expect(cycle.contractsCreated.length).toBe(2);
    expect(cycle.metrics.tasksAttempted).toBe(2);
    expect(cycle.metrics.tasksSucceeded).toBe(2);
  });

  it("runExperiment runs N cycles, saves results, returns aggregate", async () => {
    const agents = [new FakeAgent("a", wsA, "did:awp:a"), new FakeAgent("b", wsB, "did:awp:b")];
    const metrics = new MetricsCollector();
    const orch = new ExperimentOrchestrator(manifesto, agents, metrics, society, 42);

    const result = await orch.runExperiment(2);

    expect(result.totalCycles).toBe(2);
    expect(result.aggregateMetrics.totalTasks).toBeGreaterThan(0);
    expect(result.cycles).toHaveLength(2);
    // saveResults writes to <societyPath>/metrics/<experimentId>.json
    await access(join(society.path, "metrics", `${result.experimentId}.json`));
  });

  it("uses a seeded random for reproducible contract generation", async () => {
    const agents = [new FakeAgent("a", wsA, "did:awp:a"), new FakeAgent("b", wsB, "did:awp:b")];

    const orch1 = new ExperimentOrchestrator(manifesto, agents, new MetricsCollector(), society, 42);
    const c1 = await orch1.runCycle();

    const society2: SocietyConfig = { ...society, currentCycle: 0 };
    const orch2 = new ExperimentOrchestrator(manifesto, agents, new MetricsCollector(), society2, 42);
    const c2 = await orch2.runCycle();

    expect(c1.contractsCreated).toEqual(c2.contractsCreated);
  });
});
