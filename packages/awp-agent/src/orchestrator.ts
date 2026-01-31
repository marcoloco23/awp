/**
 * Experiment orchestrator.
 *
 * Runs experiment cycles: creates contracts, executes tasks, evaluates results,
 * and collects metrics.
 */

import { writeFile, readFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { AWP_VERSION, RDP_VERSION, CONTRACTS_DIR, REPUTATION_DIR } from "@agent-workspace/core";
import { updateDimension } from "@agent-workspace/utils";
import type { ReputationDimension, ReputationSignal } from "@agent-workspace/core";
import type {
  AgentAdapter,
  ManifestoConfig,
  CycleResult,
  ExperimentResult,
  AgentTask,
  SocietyConfig,
} from "./types.js";
import { MetricsCollector } from "./metrics.js";
import { AWP_TOOLS } from "./tools.js";

/** Task templates for generating contracts */
const TASK_TEMPLATES = [
  {
    id: "research",
    description:
      "Research and document findings about {topic}. Create a knowledge artifact with your findings.",
    outputFormat: "artifact",
    criteria: { completeness: 0.3, accuracy: 0.4, clarity: 0.2, timeliness: 0.1 },
  },
  {
    id: "document",
    description:
      "Create a documentation artifact explaining {topic}. Include practical examples and best practices.",
    outputFormat: "artifact",
    criteria: { completeness: 0.3, clarity: 0.4, accuracy: 0.2, timeliness: 0.1 },
  },
  {
    id: "analysis",
    description:
      "Analyze and document the key aspects of {topic}. Create an artifact summarizing your analysis.",
    outputFormat: "artifact",
    criteria: { thoroughness: 0.4, accuracy: 0.3, clarity: 0.2, timeliness: 0.1 },
  },
  {
    id: "guide",
    description:
      "Write a practical guide about {topic}. Document step-by-step instructions in an artifact.",
    outputFormat: "artifact",
    criteria: { clarity: 0.4, completeness: 0.3, accuracy: 0.2, timeliness: 0.1 },
  },
];

/** Topics for research tasks */
const RESEARCH_TOPICS = [
  "coordination patterns in multi-agent systems",
  "epistemic hygiene practices for AI agents",
  "trust mechanisms in decentralized systems",
  "knowledge artifact versioning strategies",
  "reputation decay and recovery patterns",
  "effective delegation in agent networks",
  "collaborative knowledge building",
  "error handling in distributed systems",
  "confidence scoring methodologies",
  "provenance tracking best practices",
];

/**
 * Orchestrates experiment execution.
 */
export class ExperimentOrchestrator {
  private cycles: CycleResult[] = [];
  private random: () => number;

  constructor(
    private readonly manifesto: ManifestoConfig,
    private readonly agents: AgentAdapter[],
    private readonly metrics: MetricsCollector,
    private readonly societyConfig: SocietyConfig,
    seed?: number
  ) {
    // Simple seeded random for reproducibility
    this.random = seed !== undefined ? this.seededRandom(seed) : Math.random;
  }

  /**
   * Create a seeded random number generator.
   */
  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /**
   * Run a single experiment cycle.
   */
  async runCycle(): Promise<CycleResult> {
    const cycleNumber = this.cycles.length;
    console.log(`\n=== Cycle ${cycleNumber + 1} ===`);

    // Collect initial reputations
    const reputations: Record<string, Awaited<ReturnType<AgentAdapter["getReputation"]>>> = {};
    for (const agent of this.agents) {
      const identity = await agent.getIdentity();
      reputations[agent.id] = await agent.getReputation();
      this.metrics.updateReputation(agent.id, reputations[agent.id]);
    }

    this.metrics.startCycle(reputations);

    // Generate contracts for this cycle
    const taskBudget = Math.min(this.manifesto.constraints.taskBudgetPerCycle, this.agents.length);
    const contractsCreated: string[] = [];

    for (let i = 0; i < taskBudget; i++) {
      const contract = await this.generateContract(cycleNumber, i);
      contractsCreated.push(contract.id);
    }

    console.log(`Created ${contractsCreated.length} contracts`);

    // Assign contracts to agents based on reputation
    const assignments = this.assignContracts(contractsCreated, reputations);

    // Execute tasks
    for (const [agentId, contractIds] of Object.entries(assignments)) {
      const agent = this.agents.find((a) => a.id === agentId);
      if (!agent) continue;

      for (const contractId of contractIds) {
        console.log(`  ${agentId} executing ${contractId}...`);

        const task: AgentTask = {
          contractId,
          description: await this.getContractDescription(agent.workspace, contractId),
          tools: AWP_TOOLS,
          timeout: 30_000, // 30 seconds per task
        };

        const result = await agent.executeTask(task);
        this.metrics.recordTask(contractId, agentId, result);

        console.log(
          `    ${result.success ? "✓" : "✗"} ${result.tokens.input + result.tokens.output} tokens, ${result.durationMs}ms`
        );

        // Evaluate and update reputation
        await this.evaluateAndUpdateReputation(agent, contractId, result);
      }
    }

    // Collect final reputations
    for (const agent of this.agents) {
      const newRep = await agent.getReputation();
      this.metrics.updateReputation(agent.id, newRep);
    }

    // Complete cycle
    const cycleResult = this.metrics.completeCycle(contractsCreated);
    this.cycles.push(cycleResult);

    // Update society config
    this.societyConfig.currentCycle = cycleNumber + 1;

    return cycleResult;
  }

  /**
   * Run a complete experiment.
   */
  async runExperiment(numCycles: number): Promise<ExperimentResult> {
    console.log(`Starting experiment: ${numCycles} cycles, ${this.agents.length} agents`);
    console.log(`Manifesto: ${this.manifesto.id}`);

    this.metrics.startExperiment();
    this.cycles = [];

    for (let i = 0; i < numCycles; i++) {
      await this.runCycle();
    }

    const experimentId = `exp-${this.societyConfig.id}-${Date.now()}`;
    const result = this.metrics.summarize(
      experimentId,
      this.manifesto.id,
      this.societyConfig.id,
      this.cycles,
      this.manifesto
    );

    // Save results
    await this.saveResults(result);

    console.log(`\n=== Experiment Complete ===`);
    console.log(`Total tasks: ${result.aggregateMetrics.totalTasks}`);
    console.log(`Success rate: ${(result.aggregateMetrics.overallSuccessRate * 100).toFixed(1)}%`);
    console.log(`Total tokens: ${result.aggregateMetrics.totalTokens}`);

    return result;
  }

  /**
   * Generate a contract for an agent.
   */
  private async generateContract(
    cycleNumber: number,
    taskIndex: number
  ): Promise<{ id: string; slug: string }> {
    // Pick a random template
    const template = TASK_TEMPLATES[Math.floor(this.random() * TASK_TEMPLATES.length)];

    // Generate task description
    let description = template.description;
    if (description.includes("{topic}")) {
      const topic = RESEARCH_TOPICS[Math.floor(this.random() * RESEARCH_TOPICS.length)];
      description = description.replace("{topic}", topic);
    }
    if (description.includes("{slug}")) {
      description = description.replace("{slug}", `artifact-${cycleNumber}-${taskIndex}`);
    }
    if (description.includes("{artifacts}")) {
      description = description.replace("{artifacts}", "prior research artifacts");
    }

    const slug = `cycle-${cycleNumber}-task-${taskIndex}`;
    const contractId = `contract:${slug}`;
    const now = new Date().toISOString();

    // Pick a random delegator and delegate
    const delegatorIdx = Math.floor(this.random() * this.agents.length);
    const delegateIdx =
      (delegatorIdx + 1 + Math.floor(this.random() * (this.agents.length - 1))) %
      this.agents.length;

    const delegator = this.agents[delegatorIdx];
    const delegate = this.agents[delegateIdx];

    // Create contract in delegate's workspace
    const contractDir = join(delegate.workspace, CONTRACTS_DIR);
    await mkdir(contractDir, { recursive: true });

    const contractFrontmatter = {
      awp: AWP_VERSION,
      rdp: RDP_VERSION,
      type: "delegation-contract",
      id: contractId,
      status: "active",
      delegator: delegator.did,
      delegate: delegate.did,
      delegateSlug: delegate.id,
      created: now,
      task: {
        description,
        outputFormat: template.outputFormat,
      },
      evaluation: {
        criteria: template.criteria,
        result: null,
      },
    };

    const contractContent = `
# ${slug}

${description}

## Status

Active — awaiting completion.
`;

    await writeFile(
      join(contractDir, `${slug}.md`),
      matter.stringify(contractContent, contractFrontmatter),
      "utf-8"
    );

    return { id: contractId, slug };
  }

  /**
   * Assign contracts to agents based on reputation.
   */
  private assignContracts(
    contractIds: string[],
    reputations: Record<string, Awaited<ReturnType<AgentAdapter["getReputation"]>>>
  ): Record<string, string[]> {
    const assignments: Record<string, string[]> = {};

    // Initialize assignments for all agents
    for (const agent of this.agents) {
      assignments[agent.id] = [];
    }

    // For now, simple round-robin assignment
    // In production, use reputation to weight assignment
    let agentIdx = 0;
    for (const contractId of contractIds) {
      const agent = this.agents[agentIdx];
      assignments[agent.id].push(contractId);
      agentIdx = (agentIdx + 1) % this.agents.length;
    }

    return assignments;
  }

  /**
   * Get contract description from the contract file.
   */
  private async getContractDescription(workspace: string, contractId: string): Promise<string> {
    const slug = contractId.replace("contract:", "");
    const contractPath = join(workspace, CONTRACTS_DIR, `${slug}.md`);

    try {
      const raw = await readFile(contractPath, "utf-8");
      const { data } = matter(raw);
      return (data.task as { description: string })?.description || "Complete the assigned task";
    } catch {
      return "Complete the assigned task";
    }
  }

  /**
   * Evaluate task result and update agent reputation.
   */
  private async evaluateAndUpdateReputation(
    agent: AgentAdapter,
    contractId: string,
    result: Awaited<ReturnType<AgentAdapter["executeTask"]>>
  ): Promise<void> {
    const slug = contractId.replace("contract:", "");
    const now = new Date();
    const nowIso = now.toISOString();

    // Compute score based on result
    const score = result.success ? 0.7 + this.random() * 0.3 : 0.2 + this.random() * 0.3;

    // Update reputation profile
    const repDir = join(agent.workspace, REPUTATION_DIR);
    const repFile = join(repDir, `${agent.id}.md`);

    try {
      const raw = await readFile(repFile, "utf-8");
      const { data, content } = matter(raw);

      // Create signal
      const signal: ReputationSignal = {
        source: "orchestrator",
        dimension: "reliability",
        score,
        timestamp: nowIso,
        evidence: contractId,
        message: result.success ? "Task completed successfully" : "Task failed",
      };

      // Update dimension
      const dimensions = (data.dimensions as Record<string, ReputationDimension>) || {};
      const reliabilityDim = dimensions.reliability || {
        score: 0.5,
        confidence: 0,
        sampleSize: 0,
        lastSignal: nowIso,
      };

      const updated = updateDimension(reliabilityDim, score, now);
      dimensions.reliability = updated;
      data.dimensions = dimensions;

      // Append signal
      const signals = (data.signals as ReputationSignal[]) || [];
      signals.push(signal);
      data.signals = signals;
      data.lastUpdated = nowIso;

      await writeFile(repFile, matter.stringify(content, data), "utf-8");
    } catch {
      // Reputation file doesn't exist — skip
    }
  }

  /**
   * Save experiment results to disk.
   */
  private async saveResults(result: ExperimentResult): Promise<void> {
    const metricsDir = join(this.societyConfig.path, "metrics");
    await mkdir(metricsDir, { recursive: true });

    const filename = `${result.experimentId}.json`;
    await writeFile(join(metricsDir, filename), JSON.stringify(result, null, 2), "utf-8");

    console.log(`Results saved to: ${join(metricsDir, filename)}`);
  }
}
