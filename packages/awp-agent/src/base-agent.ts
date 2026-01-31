/**
 * Base agent class with shared functionality.
 *
 * Provides common methods for system prompt building, reputation fetching,
 * and identity loading that all agent implementations can use.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { REPUTATION_DIR } from "@agent-workspace/core";
import {
  getAgentDid as getAgentDidFromWorkspace,
  computeDecayedScore,
} from "@agent-workspace/utils";
import type { ReputationDimension } from "@agent-workspace/core";
import type { AgentAdapter, AgentTask, TaskResult, AgentReputation } from "./types.js";

/** Maximum tool call iterations to prevent infinite loops */
export const MAX_ITERATIONS = 20;

/** Default timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Abstract base class for agent implementations.
 *
 * Provides shared functionality for:
 * - Building system prompts from IDENTITY.md and SOUL.md
 * - Fetching and computing reputation with decay
 * - Loading agent identity from workspace manifest
 *
 * Subclasses must implement the `executeTask` method with their specific
 * LLM provider logic.
 */
export abstract class BaseAgent implements AgentAdapter {
  protected _did: string | null = null;

  constructor(
    public readonly id: string,
    public readonly workspace: string
  ) {}

  /**
   * Get the agent's DID. Must call getIdentity() first.
   */
  get did(): string {
    if (!this._did) {
      throw new Error("Agent DID not initialized. Call getIdentity() first.");
    }
    return this._did;
  }

  /**
   * Execute a task. Must be implemented by subclasses.
   */
  abstract executeTask(task: AgentTask): Promise<TaskResult>;

  /**
   * Get the agent's current reputation profile.
   */
  async getReputation(): Promise<AgentReputation> {
    const did = await this.getAgentDid();
    const repDir = join(this.workspace, REPUTATION_DIR);

    try {
      const files = await readdir(repDir);
      const now = new Date();

      for (const f of files.filter((f) => f.endsWith(".md"))) {
        try {
          const raw = await readFile(join(repDir, f), "utf-8");
          const { data } = matter(raw);

          if (data.agentDid === did) {
            const dimensions = (data.dimensions as Record<string, ReputationDimension>) || {};

            // Compute decayed scores
            const decayedDimensions: Record<string, ReputationDimension> = {};
            let totalScore = 0;
            let dimCount = 0;

            for (const [key, dim] of Object.entries(dimensions)) {
              const decayedScore = computeDecayedScore(dim, now);
              decayedDimensions[key] = { ...dim, score: decayedScore };
              totalScore += decayedScore;
              dimCount++;
            }

            return {
              agentDid: did,
              agentName: (data.agentName as string) || this.id,
              dimensions: decayedDimensions,
              overallScore: dimCount > 0 ? totalScore / dimCount : 0.5,
            };
          }
        } catch {
          continue;
        }
      }
    } catch {
      // No reputation directory
    }

    // Return default reputation
    return this.getDefaultReputation(did);
  }

  /**
   * Get the agent's identity information.
   */
  async getIdentity(): Promise<{ name: string; did: string; role?: string }> {
    const did = await this.getAgentDid();
    this._did = did;

    try {
      const identityPath = join(this.workspace, "IDENTITY.md");
      const raw = await readFile(identityPath, "utf-8");
      const { data } = matter(raw);

      return {
        name: (data.name as string) || this.id,
        did,
        role: data.role as string | undefined,
      };
    } catch {
      return { name: this.id, did };
    }
  }

  /**
   * Build the system prompt for the agent from IDENTITY.md and SOUL.md.
   */
  protected async buildSystemPrompt(task: AgentTask): Promise<string> {
    let identity = "";
    let soul = "";

    try {
      const identityRaw = await readFile(join(this.workspace, "IDENTITY.md"), "utf-8");
      const { content } = matter(identityRaw);
      identity = content.trim();
    } catch {
      identity = `You are agent ${this.id}.`;
    }

    try {
      const soulRaw = await readFile(join(this.workspace, "SOUL.md"), "utf-8");
      const { content } = matter(soulRaw);
      soul = content.trim();
    } catch {
      // No soul file
    }

    return `${identity}

${soul ? `## Values and Behavior\n\n${soul}\n\n` : ""}## Your Current Task

You have been assigned a delegation contract: ${task.contractId}

Your workspace is at: ${this.workspace}

You have access to AWP tools for reading/writing artifacts, managing contracts, and querying reputation. Use these tools to complete your task.

## Important Guidelines

1. Work systematically — read relevant artifacts first, then create or update as needed
2. Document your work — write clear artifacts with appropriate confidence scores
3. When finished, call the task_complete tool with a summary of what you accomplished
4. If you encounter errors, try to recover or explain what went wrong`;
  }

  /**
   * Get the agent's DID from workspace manifest.
   */
  protected async getAgentDid(): Promise<string> {
    return getAgentDidFromWorkspace(this.workspace);
  }

  /**
   * Get default reputation for a new agent.
   */
  protected getDefaultReputation(did: string): AgentReputation {
    const now = new Date().toISOString();
    return {
      agentDid: did,
      agentName: this.id,
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
      overallScore: 0.5,
    };
  }
}
