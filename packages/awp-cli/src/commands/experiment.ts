/**
 * Experiment CLI commands.
 *
 * Commands for creating societies, running experiments, and comparing results.
 */

import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

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
  const outputDir = options.output || "societies";

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
    const society = await manager.createSociety(societyId, manifesto.id, numAgents, seed);

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
 * awp experiment run --society <id> --cycles <n> [--model <model>]
 */
export async function experimentRunCommand(options: {
  society: string;
  cycles: string;
  model?: string;
  manifesto: string;
}): Promise<void> {
  const { SocietyManager, parseManifesto, OpenAIAgent, ExperimentOrchestrator, MetricsCollector } =
    await import("@agent-workspace/agent");

  const numCycles = parseInt(options.cycles, 10);
  const model = options.model || "gpt-4o-mini";

  if (isNaN(numCycles) || numCycles < 1) {
    console.error("Error: --cycles must be a positive integer");
    process.exit(1);
  }

  try {
    // Load society
    const manager = new SocietyManager("societies");
    const society = await manager.loadSociety(options.society);

    console.log(`Loaded society: ${society.id}`);
    console.log(`  Agents: ${society.agents.length}`);
    console.log(`  Current cycle: ${society.currentCycle}`);

    // Load manifesto
    const manifestoPath = resolve(options.manifesto);
    const manifesto = await parseManifesto(manifestoPath);

    // Create agents
    const agents = society.agents.map((workspacePath, i) => {
      const agentId = `agent-${(i + 1).toString().padStart(2, "0")}`;
      return new OpenAIAgent(agentId, workspacePath, model);
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
    console.log(`\nRunning ${numCycles} cycles with model: ${model}`);
    const result = await orchestrator.runExperiment(numCycles);

    // Update society
    await manager.updateSociety(society);

    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Experiment ID: ${result.experimentId}`);
    console.log(`Total cycles: ${result.totalCycles}`);
    console.log(`Total tasks: ${result.aggregateMetrics.totalTasks}`);
    console.log(`Success rate: ${(result.aggregateMetrics.overallSuccessRate * 100).toFixed(1)}%`);
    console.log(`Total tokens: ${result.aggregateMetrics.totalTokens}`);
    console.log(`Duration: ${(result.aggregateMetrics.totalDurationMs / 1000).toFixed(1)}s`);

    // Estimate cost for gpt-4o-mini
    const inputCost = (result.aggregateMetrics.totalTokens * 0.5 * 0.15) / 1_000_000;
    const outputCost = (result.aggregateMetrics.totalTokens * 0.5 * 0.6) / 1_000_000;
    console.log(`Est. cost: $${(inputCost + outputCost).toFixed(4)}`);
  } catch (error) {
    console.error("Error running experiment:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * awp experiment cycle --society <id> [--model <model>]
 */
export async function experimentCycleCommand(options: {
  society: string;
  model?: string;
  manifesto: string;
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
  const { SocietyManager } = await import("@agent-workspace/agent");

  try {
    const manager = new SocietyManager("societies");
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
  const { SocietyManager } = await import("@agent-workspace/agent");
  const { readdir } = await import("node:fs/promises");
  const { join } = await import("node:path");

  try {
    const manager = new SocietyManager("societies");
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
