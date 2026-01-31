/**
 * OpenAI-based agent implementation.
 *
 * Uses the OpenAI SDK with function calling to execute AWP tasks.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import matter from "gray-matter";
import { REPUTATION_DIR } from "@agent-workspace/core";
import { getAgentDid, computeDecayedScore } from "@agent-workspace/utils";
import type { ReputationDimension } from "@agent-workspace/core";
import type {
  AgentAdapter,
  AgentTask,
  TaskResult,
  AgentReputation,
  ToolCall,
  ToolDefinition,
} from "./types.js";
import { AWP_TOOLS, executeToolCall } from "./tools.js";

/** Maximum tool call iterations to prevent infinite loops */
const MAX_ITERATIONS = 20;

/** Default timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * OpenAI-based agent that executes AWP tasks using function calling.
 */
export class OpenAIAgent implements AgentAdapter {
  private client: OpenAI;
  private _did: string | null = null;

  constructor(
    public readonly id: string,
    public readonly workspace: string,
    private readonly model: string = "gpt-4o-mini",
    apiKey?: string
  ) {
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  get did(): string {
    if (!this._did) {
      throw new Error("Agent DID not initialized. Call getIdentity() first.");
    }
    return this._did;
  }

  /**
   * Execute a task using the OpenAI function calling loop.
   */
  async executeTask(task: AgentTask): Promise<TaskResult> {
    const startTime = Date.now();
    const toolCalls: ToolCall[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let rawResponse = "";

    try {
      // Build system prompt from agent identity
      const systemPrompt = await this.buildSystemPrompt(task);

      // Convert tools to OpenAI format
      const tools = task.tools.length > 0 ? task.tools : AWP_TOOLS;
      const openaiTools = tools.map((t) => ({
        type: "function" as const,
        function: t.function,
      }));

      // Initial messages
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Please complete the following task:\n\n${task.description}\n\nUse the available tools to complete this task. When finished, call the task_complete tool with a summary of what you accomplished.`,
        },
      ];

      const timeout = task.timeout || DEFAULT_TIMEOUT_MS;
      let isComplete = false;
      let iterations = 0;
      let lastAssistantContent = "";

      // Tool calling loop
      while (!isComplete && iterations < MAX_ITERATIONS) {
        if (Date.now() - startTime > timeout) {
          return {
            success: false,
            toolCalls,
            tokens: { input: totalInputTokens, output: totalOutputTokens },
            durationMs: Date.now() - startTime,
            error: "Task timed out",
            rawResponse,
          };
        }

        iterations++;

        // Call OpenAI
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          tools: openaiTools,
          tool_choice: "auto",
        });

        const choice = response.choices[0];
        const message = choice.message;

        // Track tokens
        totalInputTokens += response.usage?.prompt_tokens || 0;
        totalOutputTokens += response.usage?.completion_tokens || 0;

        if (message.content) {
          lastAssistantContent = message.content;
          rawResponse += message.content + "\n";
        }

        // No tool calls — task complete or model finished
        if (!message.tool_calls || message.tool_calls.length === 0) {
          // Check if model naturally concluded
          if (choice.finish_reason === "stop") {
            isComplete = true;
            break;
          }
          continue;
        }

        // Add assistant message to history
        messages.push(message);

        // Process tool calls
        for (const toolCall of message.tool_calls) {
          const callStart = Date.now();
          const funcName = toolCall.function.name;
          let funcArgs: Record<string, unknown> = {};

          try {
            funcArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            funcArgs = {};
          }

          // Execute the tool
          const result = await executeToolCall(this.workspace, funcName, funcArgs);

          const tc: ToolCall = {
            id: toolCall.id,
            name: funcName,
            arguments: funcArgs,
            result: result.result,
            error: result.isError ? result.result : undefined,
            durationMs: Date.now() - callStart,
          };
          toolCalls.push(tc);

          // Add tool result to messages
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result.result,
          });

          // Check if task_complete was called
          if (funcName === "task_complete" || result.isComplete) {
            isComplete = true;
          }
        }
      }

      // Determine success
      const hasTaskComplete = toolCalls.some((tc) => tc.name === "task_complete");
      const hasErrors = toolCalls.some((tc) => tc.error);
      const success = hasTaskComplete || (isComplete && !hasErrors);

      return {
        success,
        output:
          lastAssistantContent ||
          (toolCalls.find((tc) => tc.name === "task_complete")?.arguments?.summary as string),
        toolCalls,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
        durationMs: Date.now() - startTime,
        rawResponse,
      };
    } catch (error) {
      return {
        success: false,
        toolCalls,
        tokens: { input: totalInputTokens, output: totalOutputTokens },
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        rawResponse,
      };
    }
  }

  /**
   * Get the agent's current reputation profile.
   */
  async getReputation(): Promise<AgentReputation> {
    const did = await this.getAgentDid();
    const repDir = join(this.workspace, REPUTATION_DIR);

    try {
      const files = await import("node:fs/promises").then((fs) => fs.readdir(repDir));
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
    return {
      agentDid: did,
      agentName: this.id,
      dimensions: {
        reliability: {
          score: 0.5,
          confidence: 0,
          sampleSize: 0,
          lastSignal: new Date().toISOString(),
        },
        "epistemic-hygiene": {
          score: 0.5,
          confidence: 0,
          sampleSize: 0,
          lastSignal: new Date().toISOString(),
        },
        coordination: {
          score: 0.5,
          confidence: 0,
          sampleSize: 0,
          lastSignal: new Date().toISOString(),
        },
      },
      overallScore: 0.5,
    };
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
   * Build the system prompt for the agent.
   */
  private async buildSystemPrompt(task: AgentTask): Promise<string> {
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
  private async getAgentDid(): Promise<string> {
    return getAgentDid(this.workspace);
  }
}
