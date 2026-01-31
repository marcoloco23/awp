/**
 * OpenAI-based agent implementation.
 *
 * Uses the OpenAI SDK with function calling to execute AWP tasks.
 */

import OpenAI from "openai";
import type { AgentTask, TaskResult, ToolCall } from "./types.js";
import { BaseAgent, MAX_ITERATIONS, DEFAULT_TIMEOUT_MS } from "./base-agent.js";
import { AWP_TOOLS, executeToolCall } from "./tools.js";
import { DEFAULT_OPENAI_MODEL } from "./constants.js";

/**
 * OpenAI-based agent that executes AWP tasks using function calling.
 */
export class OpenAIAgent extends BaseAgent {
  private client: OpenAI;

  constructor(
    id: string,
    workspace: string,
    private readonly model: string = DEFAULT_OPENAI_MODEL,
    apiKey?: string
  ) {
    super(id, workspace);
    this.client = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
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
        if (!choice) {
          throw new Error("OpenAI returned empty choices array");
        }
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
}
