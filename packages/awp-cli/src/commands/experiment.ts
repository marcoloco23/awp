/**
 * Experiment CLI commands.
 *
 * Commands for creating societies, running experiments, and comparing results.
 */

import { resolve, join } from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { SOCIETIES_DIR } from "@agent-workspace/agent";
import type { ExperimentResult } from "@agent-workspace/agent";

/**
 * awp experiment society create --manifesto <path> --agents <n> [--seed <n>]
 */
export async function experimentSocietyCreateCommand(options: {
  manifesto: string;
  agents: string;
  seed?: string;
  output?: string;
}): Promise<void> {
  const { SocietyManager, parseManifesto } = await import("@agent-workspace/agent");

  const manifestoPath = resolve(options.manifesto);
  const numAgents = parseInt(options.agents, 10);
  const seed = options.seed ? parseInt(options.seed, 10) : undefined;
  const outputDir = options.output || SOCIETIES_DIR;

  if (isNaN(numAgents) || numAgents < 1) {
    console.error("Error: --agents must be a positive integer");
    process.exit(1);
  }

  try {
    console.log(`Loading manifesto from: ${manifestoPath}`);
    const manifesto = await parseManifesto(manifestoPath);

    console.log(`Creating society with ${numAgents} agents...`);
    const manager = new SocietyManager(outputDir);

    const societyId = `${manifesto.id.replace(/[^a-z0-9]/gi, "-")}-${Date.now()}`;
    const society = await manager.createSociety(societyId, manifesto, numAgents, seed);

    console.log(`\nSociety created: ${society.id}`);
    console.log(`  Path: ${society.path}`);
    console.log(`  Agents: ${society.agents.length}`);
    console.log(`  Manifesto: ${society.manifestoId}`);
    if (seed !== undefined) {
      console.log(`  Seed: ${seed}`);
    }
  } catch (error) {
    console.error("Error creating society:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * awp experiment run --society <id> --cycles <n> [--model <model>] [--provider <provider>]
 */
export async function experimentRunCommand(options: {
  society: string;
  cycles: string;
  model?: string;
  manifesto: string;
  provider?: string;
}): Promise<void> {
  const {
    SocietyManager,
    parseManifesto,
    OpenAIAgent,
    AnthropicAgent,
    ExperimentOrchestrator,
    MetricsCollector,
    SOCIETIES_DIR,
    DEFAULT_OPENAI_MODEL,
    DEFAULT_ANTHROPIC_MODEL,
    PROVIDERS,
    estimateCost,
  } = await import("@agent-workspace/agent");

  const numCycles = parseInt(options.cycles, 10);
  const provider = options.provider || PROVIDERS.OPENAI;
  const defaultModel =
    provider === PROVIDERS.ANTHROPIC ? DEFAULT_ANTHROPIC_MODEL : DEFAULT_OPENAI_MODEL;
  const model = options.model || defaultModel;

  if (isNaN(numCycles) || numCycles < 1) {
    console.error("Error: --cycles must be a positive integer");
    process.exit(1);
  }

  if (![PROVIDERS.OPENAI, PROVIDERS.ANTHROPIC].includes(provider as typeof PROVIDERS.OPENAI)) {
    console.error("Error: --provider must be 'openai' or 'anthropic'");
    process.exit(1);
  }

  try {
    // Load society
    const manager = new SocietyManager(SOCIETIES_DIR);
    const society = await manager.loadSociety(options.society);

    console.log(`Loaded society: ${society.id}`);
    console.log(`  Agents: ${society.agents.length}`);
    console.log(`  Current cycle: ${society.currentCycle}`);

    // Load manifesto
    const manifestoPath = resolve(options.manifesto);
    const manifesto = await parseManifesto(manifestoPath);

    // Create agents based on provider (pass manifesto for behavior shaping)
    const agents = society.agents.map((workspacePath, i) => {
      const agentId = `agent-${(i + 1).toString().padStart(2, "0")}`;
      if (provider === "anthropic") {
        return new AnthropicAgent(agentId, workspacePath, model, undefined, manifesto);
      }
      return new OpenAIAgent(agentId, workspacePath, model, undefined, manifesto);
    });

    // Initialize agents (load identity)
    for (const agent of agents) {
      await agent.getIdentity();
    }

    // Create orchestrator
    const metrics = new MetricsCollector();
    const orchestrator = new ExperimentOrchestrator(
      manifesto,
      agents,
      metrics,
      society,
      society.seed
    );

    // Run experiment
    console.log(`\nRunning ${numCycles} cycles with provider: ${provider}, model: ${model}`);
    const result = await orchestrator.runExperiment(numCycles);

    // Update society
    await manager.updateSociety(society);

    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Experiment ID: ${result.experimentId}`);
    console.log(`Provider: ${provider}`);
    console.log(`Model: ${model}`);
    console.log(`Total cycles: ${result.totalCycles}`);
    console.log(`Total tasks: ${result.aggregateMetrics.totalTasks}`);
    console.log(`Success rate: ${(result.aggregateMetrics.overallSuccessRate * 100).toFixed(1)}%`);
    console.log(`Total tokens: ${result.aggregateMetrics.totalTokens}`);
    console.log(`Duration: ${(result.aggregateMetrics.totalDurationMs / 1000).toFixed(1)}s`);

    // Estimate cost based on provider
    const cost = estimateCost(
      provider as typeof PROVIDERS.OPENAI,
      result.aggregateMetrics.totalTokens
    );
    console.log(`Est. cost: $${cost.toFixed(4)}`);
  } catch (error) {
    console.error("Error running experiment:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * awp experiment cycle --society <id> [--model <model>] [--provider <provider>]
 */
export async function experimentCycleCommand(options: {
  society: string;
  model?: string;
  manifesto: string;
  provider?: string;
}): Promise<void> {
  // Run a single cycle - reuse experimentRunCommand with cycles=1
  await experimentRunCommand({
    ...options,
    cycles: "1",
  });
}

/**
 * awp experiment list
 */
export async function experimentListCommand(): Promise<void> {
  const { SocietyManager, SOCIETIES_DIR } = await import("@agent-workspace/agent");

  try {
    const manager = new SocietyManager(SOCIETIES_DIR);
    const societies = await manager.listSocieties();

    if (societies.length === 0) {
      console.log("No societies found. Create one with: awp experiment society create");
      return;
    }

    console.log("Societies:");
    for (const society of societies) {
      console.log(`\n  ${society.id}`);
      console.log(`    Status: ${society.status}`);
      console.log(`    Agents: ${society.agents.length}`);
      console.log(`    Cycle: ${society.currentCycle}`);
      console.log(`    Manifesto: ${society.manifestoId}`);
      console.log(`    Created: ${society.createdAt}`);
    }
  } catch (error) {
    console.error("Error listing societies:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * awp experiment show <society>
 */
export async function experimentShowCommand(societyId: string): Promise<void> {
  const { SocietyManager, SOCIETIES_DIR } = await import("@agent-workspace/agent");

  try {
    const manager = new SocietyManager(SOCIETIES_DIR);
    const society = await manager.loadSociety(societyId);

    console.log(`Society: ${society.id}`);
    console.log(`  Status: ${society.status}`);
    console.log(`  Path: ${society.path}`);
    console.log(`  Manifesto: ${society.manifestoId}`);
    console.log(`  Created: ${society.createdAt}`);
    console.log(`  Current Cycle: ${society.currentCycle}`);
    if (society.seed !== undefined) {
      console.log(`  Seed: ${society.seed}`);
    }

    console.log(`\nAgents (${society.agents.length}):`);
    for (const agentPath of society.agents) {
      const agentId = agentPath.split("/").pop();
      console.log(`  - ${agentId}`);
    }

    // List experiment results
    const metricsDir = join(society.path, "metrics");
    try {
      const files = await readdir(metricsDir);
      const resultFiles = files.filter((f) => f.endsWith(".json"));

      if (resultFiles.length > 0) {
        console.log(`\nExperiment Results (${resultFiles.length}):`);
        for (const f of resultFiles.slice(-5)) {
          console.log(`  - ${f}`);
        }
        if (resultFiles.length > 5) {
          console.log(`  ... and ${resultFiles.length - 5} more`);
        }
      }
    } catch {
      // No metrics yet
    }
  } catch (error) {
    console.error("Error showing society:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Society Lifecycle Commands
// ─────────────────────────────────────────────────────────────────────────────

/**
 * awp society pause <id>
 */
export async function societyPauseCommand(societyId: string): Promise<void> {
  const { SocietyManager, SOCIETIES_DIR } = await import("@agent-workspace/agent");

  try {
    const manager = new SocietyManager(SOCIETIES_DIR);
    await manager.pauseSociety(societyId);
    console.log(`Society paused: ${societyId}`);
  } catch (error) {
    console.error("Error pausing society:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * awp society archive <id>
 */
export async function societyArchiveCommand(societyId: string): Promise<void> {
  const { SocietyManager, SOCIETIES_DIR } = await import("@agent-workspace/agent");

  try {
    const manager = new SocietyManager(SOCIETIES_DIR);
    await manager.archiveSociety(societyId);
    console.log(`Society archived: ${societyId}`);
  } catch (error) {
    console.error("Error archiving society:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * awp society resume <id>
 */
export async function societyResumeCommand(societyId: string): Promise<void> {
  const { SocietyManager, SOCIETIES_DIR } = await import("@agent-workspace/agent");

  try {
    const manager = new SocietyManager(SOCIETIES_DIR);
    await manager.resumeSociety(societyId);
    console.log(`Society resumed: ${societyId}`);
  } catch (error) {
    console.error("Error resuming society:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Experiment Comparison
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load experiment result from a path (can be full path or society:experiment format)
 */
async function loadExperimentResult(pathOrId: string): Promise<ExperimentResult> {
  let fullPath: string;

  if (pathOrId.includes(":")) {
    // Format: society-id:experiment-id
    const [societyId, expId] = pathOrId.split(":");
    fullPath = join(SOCIETIES_DIR, societyId, "metrics", `${expId}.json`);
  } else if (pathOrId.endsWith(".json")) {
    // Full path to JSON file
    fullPath = resolve(pathOrId);
  } else {
    // Assume it's a society ID - find the latest experiment
    const metricsDir = join(SOCIETIES_DIR, pathOrId, "metrics");
    const files = await readdir(metricsDir);
    const resultFiles = files.filter((f) => f.endsWith(".json")).sort();
    if (resultFiles.length === 0) {
      throw new Error(`No experiment results found for society: ${pathOrId}`);
    }
    fullPath = join(metricsDir, resultFiles[resultFiles.length - 1]);
  }

  const raw = await readFile(fullPath, "utf-8");
  return JSON.parse(raw) as ExperimentResult;
}

/**
 * Compute trust stability from reputation changes
 */
function computeTrustStability(result: ExperimentResult): number {
  const deltas: number[] = [];
  for (const cycle of result.cycles) {
    for (const change of cycle.reputationChanges) {
      deltas.push(Math.abs(change.delta));
    }
  }
  if (deltas.length === 0) return 1.0;
  const variance = deltas.reduce((sum, d) => sum + d * d, 0) / deltas.length;
  return Math.max(0, 1 - variance);
}

/**
 * Compute average final reputation across all agents
 */
function computeAvgFinalReputation(result: ExperimentResult): number {
  const scores = Object.values(result.finalReputations).map((r) => r.overallScore);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/**
 * awp experiment compare <exp1> <exp2> [--metric <metric>]
 */
export async function experimentCompareCommand(
  exp1: string,
  exp2: string,
  options: { metric?: string }
): Promise<void> {
  try {
    const result1 = await loadExperimentResult(exp1);
    const result2 = await loadExperimentResult(exp2);

    const name1 = result1.societyId.substring(0, 20);
    const name2 = result2.societyId.substring(0, 20);

    console.log("═══════════════════════════════════════════════════════════════════════════");
    console.log(`  COMPARING EXPERIMENTS`);
    console.log("═══════════════════════════════════════════════════════════════════════════");
    console.log();
    console.log(`  A: ${result1.experimentId}`);
    console.log(`  B: ${result2.experimentId}`);
    console.log();

    // Metrics to compare
    type MetricDef = {
      name: string;
      getValue: (r: ExperimentResult) => number;
      format: (v: number) => string;
      higherIsBetter: boolean;
    };

    const metrics: MetricDef[] = [
      {
        name: "Success Rate",
        getValue: (r) => r.aggregateMetrics.overallSuccessRate,
        format: (v) => `${(v * 100).toFixed(1)}%`,
        higherIsBetter: true,
      },
      {
        name: "Total Tasks",
        getValue: (r) => r.aggregateMetrics.totalTasks,
        format: (v) => v.toString(),
        higherIsBetter: true,
      },
      {
        name: "Total Tokens",
        getValue: (r) => r.aggregateMetrics.totalTokens,
        format: (v) => v.toLocaleString(),
        higherIsBetter: false,
      },
      {
        name: "Duration (s)",
        getValue: (r) => r.aggregateMetrics.totalDurationMs / 1000,
        format: (v) => v.toFixed(1),
        higherIsBetter: false,
      },
      {
        name: "Trust Stability",
        getValue: (r) => computeTrustStability(r),
        format: (v) => v.toFixed(3),
        higherIsBetter: true,
      },
      {
        name: "Avg Reputation",
        getValue: (r) => computeAvgFinalReputation(r),
        format: (v) => v.toFixed(3),
        higherIsBetter: true,
      },
      {
        name: "Cycles",
        getValue: (r) => r.totalCycles,
        format: (v) => v.toString(),
        higherIsBetter: true,
      },
    ];

    // Filter by specific metric if requested
    const filteredMetrics = options.metric
      ? metrics.filter((m) => m.name.toLowerCase().includes(options.metric!.toLowerCase()))
      : metrics;

    if (filteredMetrics.length === 0) {
      console.error(`No metrics found matching: ${options.metric}`);
      console.log("Available metrics:", metrics.map((m) => m.name).join(", "));
      process.exit(1);
    }

    // Print comparison table
    console.log(
      `${"Metric".padEnd(20)} | ${"A".padEnd(12)} | ${"B".padEnd(12)} | ${"Delta".padEnd(12)} | Winner`
    );
    console.log(
      `${"-".repeat(20)}-+-${"-".repeat(12)}-+-${"-".repeat(12)}-+-${"-".repeat(12)}-+-------`
    );

    for (const metric of filteredMetrics) {
      const v1 = metric.getValue(result1);
      const v2 = metric.getValue(result2);
      const delta = v2 - v1;

      let winner = "-";
      if (Math.abs(delta) > 0.001) {
        if (metric.higherIsBetter) {
          winner = delta > 0 ? "B" : "A";
        } else {
          winner = delta < 0 ? "B" : "A";
        }
      }

      const deltaStr = delta > 0 ? `+${metric.format(delta)}` : metric.format(delta);

      console.log(
        `${metric.name.padEnd(20)} | ${metric.format(v1).padEnd(12)} | ${metric.format(v2).padEnd(12)} | ${deltaStr.padEnd(12)} | ${winner}`
      );
    }

    console.log();
    console.log("═══════════════════════════════════════════════════════════════════════════");

    // Success criteria comparison
    if (result1.successCriteriaResults.length > 0 || result2.successCriteriaResults.length > 0) {
      console.log();
      console.log("Success Criteria:");
      const allCriteria = new Set([
        ...result1.successCriteriaResults.map((c) => c.criterionId),
        ...result2.successCriteriaResults.map((c) => c.criterionId),
      ]);

      for (const criterionId of allCriteria) {
        const c1 = result1.successCriteriaResults.find((c) => c.criterionId === criterionId);
        const c2 = result2.successCriteriaResults.find((c) => c.criterionId === criterionId);
        const met1 = c1?.met ? "✓" : "✗";
        const met2 = c2?.met ? "✓" : "✗";
        console.log(`  ${criterionId.padEnd(30)} A: ${met1}  B: ${met2}`);
      }
    }
  } catch (error) {
    console.error("Error comparing experiments:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
