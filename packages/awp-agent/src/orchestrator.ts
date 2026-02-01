/**
 * Experiment orchestrator.
 *
 * Runs experiment cycles: creates contracts, executes tasks, evaluates results,
 * and collects metrics.
 */

import { readFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { AWP_VERSION, RDP_VERSION, CONTRACTS_DIR, REPUTATION_DIR } from "@agent-workspace/core";
import { updateDimension, atomicWriteFile, withFileLock, safeWriteJson } from "@agent-workspace/utils";
import type { ReputationDimension, ReputationSignal } from "@agent-workspace/core";
import type {
  AgentAdapter,
  ManifestoConfig,
  CycleResult,
  ExperimentResult,
  AgentTask,
  TaskResult,
  SocietyConfig,
} from "./types.js";
import { MetricsCollector } from "./metrics.js";
import { AWP_TOOLS } from "./tools.js";
import { detectAntiPatterns } from "./anti-patterns.js";

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

    // Run anti-pattern detection
    const antiPatterns = await detectAntiPatterns(this.agents, this.manifesto);
    if (antiPatterns.length > 0) {
      console.log(`  Anti-patterns detected: ${antiPatterns.length}`);
      for (const ap of antiPatterns) {
        console.log(`    ${ap.patternId} — ${ap.agentId} (penalty: ${ap.penalty})`);
        this.metrics.recordAntiPattern(ap.patternId, ap.agentId, ap.penalty);

        // Apply penalty to agent's reputation
        await this.applyAntiPatternPenalty(ap.agentId, ap.patternId, ap.penalty);
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

    await atomicWriteFile(
      join(contractDir, `${slug}.md`),
      matter.stringify(contractContent, contractFrontmatter)
    );

    return { id: contractId, slug };
  }

  /**
   * Compute purity-weighted score for an agent based on manifesto weights.
   */
  private computePurityScore(
    reputation: Awaited<ReturnType<AgentAdapter["getReputation"]>>
  ): number {
    let score = 0;
    let totalWeight = 0;

    for (const [dimension, weight] of Object.entries(this.manifesto.purity)) {
      const dim = reputation.dimensions[dimension];
      if (dim) {
        score += dim.score * weight;
        totalWeight += weight;
      }
    }

    return totalWeight > 0 ? score / totalWeight : 0.5;
  }

  /**
   * Assign contracts to agents weighted by reputation (softmax selection).
   */
  private assignContracts(
    contractIds: string[],
    reputations: Record<string, Awaited<ReturnType<AgentAdapter["getReputation"]>>>
  ): Record<string, string[]> {
    const assignments: Record<string, string[]> = {};
    const maxContracts = this.manifesto.constraints.maxContractsPerAgent;

    // Initialize assignments for all agents
    for (const agent of this.agents) {
      assignments[agent.id] = [];
    }

    // Compute purity-weighted scores for each agent
    const scores = this.agents.map((agent) => {
      const rep = reputations[agent.id];
      return rep ? this.computePurityScore(rep) : 0.5;
    });

    // Softmax with temperature=0.5 (sharper distribution)
    const temperature = 0.5;
    const expScores = scores.map((s) => Math.exp(s / temperature));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const probabilities = expScores.map((e) => e / sumExp);

    // Assign contracts using weighted random selection
    for (const contractId of contractIds) {
      // Sample from distribution, respecting maxContracts
      let assigned = false;
      let attempts = 0;

      while (!assigned && attempts < this.agents.length * 3) {
        const r = this.random();
        let cumulative = 0;

        for (let i = 0; i < this.agents.length; i++) {
          cumulative += probabilities[i];
          if (r <= cumulative) {
            if (assignments[this.agents[i].id].length < maxContracts) {
              assignments[this.agents[i].id].push(contractId);
              assigned = true;
            }
            break;
          }
        }

        attempts++;
      }

      // Fallback: assign to agent with fewest contracts
      if (!assigned) {
        const minAgent = this.agents.reduce((min, agent) =>
          assignments[agent.id].length < assignments[min.id].length ? agent : min
        );
        assignments[minAgent.id].push(contractId);
      }
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
   * Score epistemic hygiene from task result.
   *
   * Evaluates:
   * - Artifact confidence scores (moderate 0.4-0.7 rewarded, overconfident >0.9 penalized)
   * - Uncertainty language in output (hedging markers increase score)
   * - Having any confidence score vs none
   */
  private scoreEpistemicHygiene(result: TaskResult): number {
    let score = 0.5; // baseline
    let signals = 0;

    // Check artifact writes for confidence scores
    const artifactWrites = result.toolCalls.filter((tc) => tc.name === "awp_artifact_write");
    if (artifactWrites.length > 0) {
      for (const write of artifactWrites) {
        const confidence = write.arguments?.confidence as number | undefined;
        if (confidence !== undefined) {
          signals++;
          // Reward moderate confidence, penalize overconfidence
          if (confidence >= 0.4 && confidence <= 0.7) {
            score += 0.15; // well-calibrated
          } else if (confidence > 0.9) {
            score -= 0.1; // overconfident
          } else if (confidence < 0.3) {
            score += 0.05; // at least honest about uncertainty
          } else {
            score += 0.05; // reasonable range
          }
        } else {
          // No confidence score at all — slight penalty
          signals++;
          score -= 0.05;
        }
      }
    }

    // Check output for uncertainty language
    const output = (result.output || result.rawResponse || "").toLowerCase();
    const hedgingMarkers = [
      "uncertain", "unclear", "might", "perhaps", "likely",
      "appears to", "seems", "it is possible", "low confidence",
      "speculate", "preliminary", "tentative",
    ];
    const overconfidenceMarkers = [
      "definitely", "certainly", "obviously", "clearly",
      "without doubt", "undoubtedly", "absolutely",
    ];

    const hedgeCount = hedgingMarkers.filter((m) => output.includes(m)).length;
    const overconfidenceCount = overconfidenceMarkers.filter((m) => output.includes(m)).length;

    if (hedgeCount > 0) {
      score += Math.min(hedgeCount * 0.03, 0.12);
      signals++;
    }
    if (overconfidenceCount > 0) {
      score -= Math.min(overconfidenceCount * 0.03, 0.1);
      signals++;
    }

    // Clamp and add noise
    return Math.max(0.1, Math.min(0.95, score + (this.random() - 0.5) * 0.1));
  }

  /**
   * Score coordination from task result.
   *
   * Evaluates:
   * - Read-before-write pattern (artifact_read/list before artifact_write)
   * - Contract lifecycle compliance (accept + complete)
   */
  private scoreCoordination(result: TaskResult): number {
    let score = 0.5; // baseline

    const toolNames = result.toolCalls.map((tc) => tc.name);

    // Read-before-write pattern
    const hasRead = toolNames.includes("awp_artifact_read") || toolNames.includes("awp_artifact_list");
    const hasWrite = toolNames.includes("awp_artifact_write");

    if (hasWrite && hasRead) {
      // First read index before first write index
      const firstReadIdx = toolNames.findIndex(
        (n) => n === "awp_artifact_read" || n === "awp_artifact_list"
      );
      const firstWriteIdx = toolNames.findIndex((n) => n === "awp_artifact_write");

      if (firstReadIdx < firstWriteIdx) {
        score += 0.15; // good: read before write
      } else {
        score += 0.05; // at least both happened
      }
    } else if (hasWrite && !hasRead) {
      score -= 0.05; // wrote without reading existing artifacts
    }

    // Contract lifecycle compliance
    const hasAccept = toolNames.includes("awp_contract_accept");
    const hasComplete = toolNames.includes("awp_contract_complete") || toolNames.includes("task_complete");

    if (hasAccept && hasComplete) {
      score += 0.15; // proper lifecycle
    } else if (hasComplete && !hasAccept) {
      score += 0.05; // completed but didn't formally accept
    } else if (!hasComplete) {
      score -= 0.1; // didn't signal completion
    }

    // Clamp and add noise
    return Math.max(0.1, Math.min(0.95, score + (this.random() - 0.5) * 0.1));
  }

  /**
   * Evaluate task result and update agent reputation across all dimensions.
   */
  private async evaluateAndUpdateReputation(
    agent: AgentAdapter,
    contractId: string,
    result: TaskResult
  ): Promise<void> {
    const now = new Date();
    const nowIso = now.toISOString();

    // Compute scores for each dimension
    const reliabilityScore = result.success ? 0.7 + this.random() * 0.3 : 0.2 + this.random() * 0.3;
    const epistemicScore = this.scoreEpistemicHygiene(result);
    const coordinationScore = this.scoreCoordination(result);

    const dimensionScores: Array<{ dimension: string; score: number; message: string }> = [
      {
        dimension: "reliability",
        score: reliabilityScore,
        message: result.success ? "Task completed successfully" : "Task failed",
      },
      {
        dimension: "epistemic-hygiene",
        score: epistemicScore,
        message: `Epistemic hygiene: confidence calibration ${epistemicScore > 0.6 ? "good" : "needs improvement"}`,
      },
      {
        dimension: "coordination",
        score: coordinationScore,
        message: `Coordination: ${coordinationScore > 0.6 ? "good patterns" : "suboptimal patterns"}`,
      },
    ];

    // Update reputation profile
    const repDir = join(agent.workspace, REPUTATION_DIR);
    const repFile = join(repDir, `${agent.id}.md`);

    try {
      await withFileLock(repFile, async () => {
        const raw = await readFile(repFile, "utf-8");
        const { data, content } = matter(raw);
        const dimensions = (data.dimensions as Record<string, ReputationDimension>) || {};
        const signals = (data.signals as ReputationSignal[]) || [];

        for (const { dimension, score, message } of dimensionScores) {
          // Create signal
          const signal: ReputationSignal = {
            source: "orchestrator",
            dimension,
            score,
            timestamp: nowIso,
            evidence: contractId,
            message,
          };
          signals.push(signal);

          // Update dimension
          const dim = dimensions[dimension] || {
            score: 0.5,
            confidence: 0,
            sampleSize: 0,
            lastSignal: nowIso,
          };
          dimensions[dimension] = updateDimension(dim, score, now);
        }

        data.dimensions = dimensions;
        data.signals = signals;
        data.lastUpdated = nowIso;

        await atomicWriteFile(repFile, matter.stringify(content, data));
      });
    } catch {
      // Reputation file doesn't exist — skip
    }
  }

  /**
   * Apply a reputation penalty for a detected anti-pattern.
   */
  private async applyAntiPatternPenalty(
    agentId: string,
    patternId: string,
    penalty: number
  ): Promise<void> {
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) return;

    const now = new Date();
    const nowIso = now.toISOString();
    const repDir = join(agent.workspace, REPUTATION_DIR);
    const repFile = join(repDir, `${agentId}.md`);

    // Map anti-patterns to affected reputation dimensions
    const affectedDimensions: Record<string, string[]> = {
      "artifact-spam": ["epistemic-hygiene", "coordination"],
      "self-promotion": ["reliability", "epistemic-hygiene"],
      "coalition-capture": ["coordination", "reliability"],
    };

    const dimensions = affectedDimensions[patternId] || ["reliability"];

    try {
      await withFileLock(repFile, async () => {
        const raw = await readFile(repFile, "utf-8");
        const { data, content } = matter(raw);
        const dims = (data.dimensions as Record<string, ReputationDimension>) || {};
        const signals = (data.signals as ReputationSignal[]) || [];

        for (const dimension of dimensions) {
          // Create a negative signal representing the penalty
          const penaltyScore = Math.max(0, 0.5 - penalty);
          const signal: ReputationSignal = {
            source: "anti-pattern-detector",
            dimension,
            score: penaltyScore,
            timestamp: nowIso,
            evidence: `anti-pattern:${patternId}`,
            message: `Anti-pattern detected: ${patternId} (penalty: ${penalty})`,
          };
          signals.push(signal);

          // Update dimension with the penalty signal
          const dim = dims[dimension] || {
            score: 0.5,
            confidence: 0,
            sampleSize: 0,
            lastSignal: nowIso,
          };
          dims[dimension] = updateDimension(dim, penaltyScore, now);
        }

        data.dimensions = dims;
        data.signals = signals;
        data.lastUpdated = nowIso;

        await atomicWriteFile(repFile, matter.stringify(content, data));
      });
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
    const filePath = join(metricsDir, filename);
    await safeWriteJson(filePath, result);

    console.log(`Results saved to: ${filePath}`);
  }
}
