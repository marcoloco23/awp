/**
 * Anthropic-based agent implementation.
 *
 * Uses the Anthropic SDK with tool_use to execute AWP tasks.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AgentTask, TaskResult, ToolCall, ToolDefinition, ManifestoConfig } from "./types.js";
import { BaseAgent, MAX_ITERATIONS, DEFAULT_TIMEOUT_MS } from "./base-agent.js";
import { AWP_TOOLS, executeToolCall } from "./tools.js";
import { DEFAULT_ANTHROPIC_MODEL, DEFAULT_ANTHROPIC_MAX_TOKENS } from "./constants.js";

/**
 * Convert OpenAI-style tool definitions to Anthropic format.
 */
function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
  }));
}

/**
 * Anthropic-based agent that executes AWP tasks using tool_use.
 */
export class AnthropicAgent extends BaseAgent {
  private client: Anthropic;

  constructor(
    id: string,
    workspace: string,
    private readonly model: string = DEFAULT_ANTHROPIC_MODEL,
    apiKey?: string,
    manifesto?: ManifestoConfig
  ) {
    super(id, workspace, manifesto);
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Execute a task using the Anthropic tool_use loop.
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

      // Convert tools to Anthropic format
      const tools = task.tools.length > 0 ? task.tools : AWP_TOOLS;
      const anthropicTools = toAnthropicTools(tools);

      // Initial messages
      const messages: Anthropic.MessageParam[] = [
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

        // Call Anthropic
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: DEFAULT_ANTHROPIC_MAX_TOKENS,
          system: systemPrompt,
          tools: anthropicTools,
          messages,
        });

        // Track tokens
        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;

        // Process response content blocks
        const toolUseBlocks: Anthropic.ToolUseBlock[] = [];
        for (const block of response.content) {
          if (block.type === "text") {
            lastAssistantContent = block.text;
            rawResponse += block.text + "\n";
          } else if (block.type === "tool_use") {
            toolUseBlocks.push(block);
          }
        }

        // No tool calls — check if model finished
        if (toolUseBlocks.length === 0) {
          if (response.stop_reason === "end_turn") {
            isComplete = true;
            break;
          }
          continue;
        }

        // Add assistant message to history
        messages.push({
          role: "assistant",
          content: response.content,
        });

        // Process tool calls and collect results
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolUse of toolUseBlocks) {
          const callStart = Date.now();
          const funcName = toolUse.name;
          const funcArgs = toolUse.input as Record<string, unknown>;

          // Execute the tool
          const result = await executeToolCall(this.workspace, funcName, funcArgs);

          const tc: ToolCall = {
            id: toolUse.id,
            name: funcName,
            arguments: funcArgs,
            result: result.result,
            error: result.isError ? result.result : undefined,
            durationMs: Date.now() - callStart,
          };
          toolCalls.push(tc);

          // Add to tool results
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: result.result,
            is_error: result.isError,
          });

          // Check if task_complete was called
          if (funcName === "task_complete" || result.isComplete) {
            isComplete = true;
          }
        }

        // Add tool results as user message
        messages.push({
          role: "user",
          content: toolResults,
        });
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
}
