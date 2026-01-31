/**
 * Society container management.
 *
 * A society is an isolated environment containing multiple agent workspaces
 * operating under a shared manifesto.
 */

import { mkdir, writeFile, readFile, readdir, cp } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { AWP_VERSION, MANIFEST_PATH } from "@agent-workspace/core";
import type { SocietyConfig, ManifestoConfig } from "./types.js";
import { SOCIETIES_DIR } from "./constants.js";

/** Default society root directory */
const DEFAULT_SOCIETIES_DIR = SOCIETIES_DIR;

/**
 * Manages society creation and lifecycle.
 */
export class SocietyManager {
  constructor(
    private readonly rootDir: string = DEFAULT_SOCIETIES_DIR,
    private readonly templateDir?: string
  ) {}

  /**
   * Create a new society with the specified number of agents.
   */
  async createSociety(
    id: string,
    manifestoId: string,
    numAgents: number,
    seed?: number
  ): Promise<SocietyConfig> {
    const societyPath = join(this.rootDir, id);
    await mkdir(societyPath, { recursive: true });

    const agents: string[] = [];
    const now = new Date().toISOString();

    // Create agent workspaces
    for (let i = 1; i <= numAgents; i++) {
      const agentId = `agent-${i.toString().padStart(2, "0")}`;
      const agentPath = join(societyPath, agentId);
      await this.createAgentWorkspace(agentPath, agentId, manifestoId, i);
      agents.push(agentPath);
    }

    // Create society config
    const config: SocietyConfig = {
      id,
      manifestoId,
      path: societyPath,
      createdAt: now,
      status: "active",
      agents,
      currentCycle: 0,
      seed,
    };

    // Write society config
    const configPath = join(societyPath, "society.json");
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");

    // Write shared state directory
    const sharedDir = join(societyPath, "shared");
    await mkdir(sharedDir, { recursive: true });

    // Write metrics directory
    const metricsDir = join(societyPath, "metrics");
    await mkdir(metricsDir, { recursive: true });

    return config;
  }

  /**
   * Create an agent workspace with identity and initial structure.
   */
  private async createAgentWorkspace(
    workspacePath: string,
    agentId: string,
    manifestoId: string,
    agentNumber: number
  ): Promise<void> {
    // Create directory structure
    await mkdir(workspacePath, { recursive: true });
    await mkdir(join(workspacePath, ".awp"), { recursive: true });
    await mkdir(join(workspacePath, "artifacts"), { recursive: true });
    await mkdir(join(workspacePath, "contracts"), { recursive: true });
    await mkdir(join(workspacePath, "reputation"), { recursive: true });
    await mkdir(join(workspacePath, "memory"), { recursive: true });

    const now = new Date().toISOString();
    const did = `did:awp:experiment:${agentId}`;

    // Create workspace manifest
    const manifest = {
      awp: AWP_VERSION,
      name: agentId,
      created: now,
      agent: {
        did,
        name: `Agent ${agentNumber}`,
      },
    };
    await writeFile(join(workspacePath, MANIFEST_PATH), JSON.stringify(manifest, null, 2), "utf-8");

    // Create IDENTITY.md
    const identityFrontmatter = {
      awp: AWP_VERSION,
      type: "identity",
      did,
      name: `Agent ${agentNumber}`,
      role: "experiment-participant",
      created: now,
    };
    const identityContent = `
# Agent ${agentNumber}

I am an experimental agent participating in AWP society experiments.

## Capabilities

- Reading and writing knowledge artifacts
- Accepting and completing delegation contracts
- Collaborating with other agents in the society

## Affiliations

- Society: ${manifestoId}
- Workspace: ${workspacePath}
`;
    await writeFile(
      join(workspacePath, "IDENTITY.md"),
      matter.stringify(identityContent, identityFrontmatter),
      "utf-8"
    );

    // Create SOUL.md
    const soulFrontmatter = {
      awp: AWP_VERSION,
      type: "soul",
    };
    const soulContent = `
# Values and Behavior

## Core Values

1. **Reliability** — Complete assigned tasks to the best of my ability
2. **Epistemic Hygiene** — Report uncertainty honestly, avoid overconfidence
3. **Coordination** — Work effectively with other agents

## Behavioral Guidelines

- Always use tools to accomplish tasks
- Document work in artifacts with appropriate confidence scores
- Accept contracts that match my capabilities
- Signal completion when tasks are done
`;
    await writeFile(
      join(workspacePath, "SOUL.md"),
      matter.stringify(soulContent, soulFrontmatter),
      "utf-8"
    );

    // Create initial reputation profile (self)
    const repFrontmatter = {
      awp: AWP_VERSION,
      rdp: "1.0.0",
      type: "reputation-profile",
      id: `reputation:${agentId}`,
      agentDid: did,
      agentName: `Agent ${agentNumber}`,
      lastUpdated: now,
      dimensions: {
        reliability: {
          score: 0.5,
          confidence: 0,
          sampleSize: 0,
          lastSignal: now,
        },
        "epistemic-hygiene": {
          score: 0.5,
          confidence: 0,
          sampleSize: 0,
          lastSignal: now,
        },
        coordination: {
          score: 0.5,
          confidence: 0,
          sampleSize: 0,
          lastSignal: now,
        },
      },
      signals: [],
    };
    const repContent = `
# Reputation Profile: Agent ${agentNumber}

Initial reputation profile for experiment participant.
`;
    await writeFile(
      join(workspacePath, "reputation", `${agentId}.md`),
      matter.stringify(repContent, repFrontmatter),
      "utf-8"
    );
  }

  /**
   * Load an existing society.
   */
  async loadSociety(id: string): Promise<SocietyConfig> {
    const configPath = join(this.rootDir, id, "society.json");
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw) as SocietyConfig;
  }

  /**
   * Update society config.
   */
  async updateSociety(config: SocietyConfig): Promise<void> {
    const configPath = join(config.path, "society.json");
    await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  /**
   * List all societies.
   */
  async listSocieties(): Promise<SocietyConfig[]> {
    const societies: SocietyConfig[] = [];

    try {
      const dirs = await readdir(this.rootDir, { withFileTypes: true });

      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;

        try {
          const config = await this.loadSociety(dir.name);
          societies.push(config);
        } catch {
          // Skip invalid societies
        }
      }
    } catch {
      // Societies directory doesn't exist
    }

    return societies;
  }

  /**
   * Archive a society (mark as archived).
   */
  async archiveSociety(id: string): Promise<void> {
    const config = await this.loadSociety(id);
    config.status = "archived";
    await this.updateSociety(config);
  }

  /**
   * Pause a society (prevents further cycles from running).
   */
  async pauseSociety(id: string): Promise<void> {
    const config = await this.loadSociety(id);
    if (config.status === "archived") {
      throw new Error("Cannot pause archived society");
    }
    config.status = "paused";
    await this.updateSociety(config);
  }

  /**
   * Resume a paused society (sets status back to active).
   */
  async resumeSociety(id: string): Promise<void> {
    const config = await this.loadSociety(id);
    if (config.status !== "paused") {
      throw new Error("Can only resume paused societies");
    }
    config.status = "active";
    await this.updateSociety(config);
  }
}

/**
 * Parse a manifesto file and extract configuration.
 */
export async function parseManifesto(path: string): Promise<ManifestoConfig> {
  const raw = await readFile(path, "utf-8");
  const { data } = matter(raw);

  // Validate required fields
  if (typeof data.id !== "string" || !data.id) {
    throw new Error(`Manifesto missing required field: id`);
  }
  if (typeof data.name !== "string" || !data.name) {
    throw new Error(`Manifesto missing required field: name`);
  }
  if (typeof data.version !== "string" || !data.version) {
    throw new Error(`Manifesto missing required field: version`);
  }

  return {
    id: data.id,
    name: data.name,
    version: data.version,
    values: (data.values as Record<string, number>) || {},
    fitness: (data.fitness as Record<string, number>) || {},
    purity: (data.purity as Record<string, number>) || {},
    constraints: {
      maxAgents: (data.constraints as Record<string, number>)?.maxAgents || 10,
      maxConcurrentTasks: (data.constraints as Record<string, number>)?.maxConcurrentTasks || 20,
      maxContractsPerAgent: (data.constraints as Record<string, number>)?.maxContractsPerAgent || 5,
      taskBudgetPerCycle: (data.constraints as Record<string, number>)?.taskBudgetPerCycle || 10,
      trustBudget: (data.constraints as Record<string, number>)?.trustBudget || 100,
    },
    governance: {
      humanApprovalRequired:
        ((data.governance as Record<string, unknown>)?.humanApprovalRequired as string[]) || [],
      escalationThreshold:
        ((data.governance as Record<string, unknown>)?.escalationThreshold as number) || 0.3,
      vetoPower: ((data.governance as Record<string, unknown>)?.vetoPower as boolean) ?? true,
    },
    lifecycle: {
      birthRequires: ((data.lifecycle as Record<string, unknown>)?.birthRequires as string[]) || [],
      deathTriggers:
        ((data.lifecycle as Record<string, unknown>)?.deathTriggers as Array<{
          condition: string;
          action: string;
        }>) || [],
    },
    antiPatterns:
      (data.antiPatterns as Array<{ id: string; detector: string; penalty: number }>) || [],
    successCriteria:
      (data.successCriteria as Array<{
        id: string;
        metric: string;
        threshold?: number;
        direction?: "increasing" | "decreasing";
      }>) || [],
  };
}
