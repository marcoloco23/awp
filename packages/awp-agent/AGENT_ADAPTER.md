# AgentAdapter Interface

The `AgentAdapter` interface defines the contract for implementing custom LLM backends in the AWP experiment framework. This enables testing with different AI providers while maintaining consistent experiment orchestration.

## Interface Definition

```typescript
interface AgentAdapter {
  /** Unique agent identifier */
  readonly id: string;
  
  /** Path to agent's workspace directory */
  readonly workspace: string;
  
  /** Agent's DID (decentralized identifier) */
  readonly did: string;

  /**
   * Execute a task and return the result.
   * The agent should use available tools to complete the task.
   */
  executeTask(task: AgentTask): Promise<TaskResult>;

  /**
   * Get the agent's current reputation profile
   */
  getReputation(): Promise<AgentReputation>;

  /**
   * Get the agent's identity information (from IDENTITY.md)
   */
  getIdentity(): Promise<{
    name: string;
    did: string;
    role?: string;
  }>;
}
```

## Built-in Implementations

### OpenAIAgent

Uses the OpenAI SDK with function calling.

```typescript
import { OpenAIAgent } from "@agent-workspace/agent";

const agent = new OpenAIAgent(
  "agent-01",           // id
  "/path/to/workspace", // workspace
  "gpt-4o-mini",        // model (optional, default: "gpt-4o-mini")
  process.env.OPENAI_API_KEY // apiKey (optional, uses env var by default)
);
```

**Environment Variable:** `OPENAI_API_KEY`

### AnthropicAgent

Uses the Anthropic SDK with tool_use.

```typescript
import { AnthropicAgent } from "@agent-workspace/agent";

const agent = new AnthropicAgent(
  "agent-01",           // id
  "/path/to/workspace", // workspace
  "claude-sonnet-4-20250514", // model (optional)
  process.env.ANTHROPIC_API_KEY // apiKey (optional, uses env var by default)
);
```

**Environment Variable:** `ANTHROPIC_API_KEY`

## Implementing a Custom Adapter

To implement a custom adapter, extend the `BaseAgent` class which provides shared functionality for identity loading, reputation fetching, and system prompt building.

### Step 1: Extend BaseAgent

```typescript
import { BaseAgent, AgentTask, TaskResult, ToolCall } from "@agent-workspace/agent";
import { AWP_TOOLS, executeToolCall } from "@agent-workspace/agent";

export class CustomAgent extends BaseAgent {
  private client: YourLLMClient;

  constructor(
    id: string,
    workspace: string,
    private readonly model: string = "default-model",
    apiKey?: string
  ) {
    super(id, workspace);
    this.client = new YourLLMClient({
      apiKey: apiKey || process.env.YOUR_API_KEY,
    });
  }

  async executeTask(task: AgentTask): Promise<TaskResult> {
    // Implementation here
  }
}
```

### Step 2: Implement the Task Execution Loop

The `executeTask` method should:

1. Build a system prompt using `this.buildSystemPrompt(task)`
2. Send the task to the LLM with available tools
3. Process tool calls in a loop until completion
4. Track token usage and execution time
5. Return a `TaskResult`

```typescript
async executeTask(task: AgentTask): Promise<TaskResult> {
  const startTime = Date.now();
  const toolCalls: ToolCall[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let rawResponse = "";

  try {
    // 1. Build system prompt from agent identity
    const systemPrompt = await this.buildSystemPrompt(task);

    // 2. Get available tools
    const tools = task.tools.length > 0 ? task.tools : AWP_TOOLS;

    // 3. Convert tools to your LLM's format
    const llmTools = this.convertToLLMFormat(tools);

    // 4. Initialize message history
    const messages = [
      { role: "user", content: task.description }
    ];

    let isComplete = false;
    let iterations = 0;

    // 5. Tool calling loop
    while (!isComplete && iterations < MAX_ITERATIONS) {
      iterations++;

      // Call your LLM
      const response = await this.client.chat({
        model: this.model,
        system: systemPrompt,
        messages,
        tools: llmTools,
      });

      // Track tokens
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Process tool calls
      for (const toolUse of response.toolCalls) {
        const result = await executeToolCall(
          this.workspace, 
          toolUse.name, 
          toolUse.arguments
        );

        toolCalls.push({
          id: toolUse.id,
          name: toolUse.name,
          arguments: toolUse.arguments,
          result: result.result,
          error: result.isError ? result.result : undefined,
          durationMs: /* measure this */,
        });

        // Check for task completion
        if (toolUse.name === "task_complete" || result.isComplete) {
          isComplete = true;
        }
      }

      // Update message history for next iteration
      // (varies by LLM API)
    }

    // 6. Determine success
    const success = toolCalls.some(tc => tc.name === "task_complete");

    return {
      success,
      output: /* extract output */,
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
```

## Available Tools

The `AWP_TOOLS` array provides standard AWP operations in OpenAI function calling format:

| Tool | Description |
|------|-------------|
| `awp_artifact_read` | Read a knowledge artifact by slug |
| `awp_artifact_write` | Write/update a knowledge artifact |
| `awp_artifact_list` | List all artifacts in workspace |
| `awp_contract_accept` | Accept a delegation contract |
| `awp_contract_complete` | Mark contract as complete |
| `awp_reputation_query` | Query an agent's reputation |
| `task_complete` | Signal task completion with summary |

### Executing Tool Calls

Use the `executeToolCall` function to execute AWP operations:

```typescript
import { executeToolCall } from "@agent-workspace/agent";

const result = await executeToolCall(
  workspace,    // Agent's workspace path
  "awp_artifact_write",  // Tool name
  {             // Tool arguments
    slug: "my-artifact",
    content: "...",
    confidence: 0.8
  }
);

// result.result: string output
// result.isError: boolean
// result.isComplete: boolean (true for task_complete)
```

## Type Definitions

### AgentTask

```typescript
interface AgentTask {
  /** Contract ID (e.g., "contract:review-artifact-001") */
  contractId: string;
  /** Human-readable task description */
  description: string;
  /** Tools available for this task */
  tools: ToolDefinition[];
  /** Maximum execution time in milliseconds */
  timeout?: number;
  /** Expected output format */
  outputFormat?: string;
  /** Expected output artifact slug */
  outputSlug?: string;
}
```

### TaskResult

```typescript
interface TaskResult {
  /** Whether the task completed successfully */
  success: boolean;
  /** Task output (e.g., artifact content, message) */
  output?: string;
  /** All tool calls made during execution */
  toolCalls: ToolCall[];
  /** Token usage */
  tokens: { input: number; output: number };
  /** Execution time in milliseconds */
  durationMs: number;
  /** Error message if task failed */
  error?: string;
  /** Raw LLM response for debugging */
  rawResponse?: string;
}
```

### AgentReputation

```typescript
interface AgentReputation {
  agentDid: string;
  agentName: string;
  dimensions: Record<string, ReputationDimension>;
  overallScore: number;
}
```

## BaseAgent Helpers

When extending `BaseAgent`, you inherit these protected methods:

| Method | Description |
|--------|-------------|
| `buildSystemPrompt(task)` | Builds prompt from IDENTITY.md + SOUL.md |
| `getAgentDid()` | Gets DID from workspace manifest |
| `getDefaultReputation(did)` | Returns default reputation for new agents |

And these public methods (already implemented):

| Method | Description |
|--------|-------------|
| `getReputation()` | Returns current reputation with decay applied |
| `getIdentity()` | Returns identity from IDENTITY.md |

## Testing Your Adapter

Test your adapter with the experiment framework:

```typescript
import { ExperimentOrchestrator, SocietyManager, parseManifesto } from "@agent-workspace/agent";
import { CustomAgent } from "./custom-agent.js";

// Parse manifesto
const manifesto = await parseManifesto("/path/to/MANIFESTO.md");

// Create society
const society = await new SocietyManager().createSociety(
  manifesto, 
  "/path/to/societies", 
  3  // agent count
);

// Create custom agents
const agents = society.agents.map(
  (ws, i) => new CustomAgent(`agent-${i + 1}`, ws)
);

// Run experiment
const orchestrator = new ExperimentOrchestrator(
  agents,
  society,
  manifesto
);

const result = await orchestrator.runExperiment({
  cycles: 3,
  seed: 12345,
});

console.log(`Success rate: ${result.aggregateMetrics.overallSuccessRate}`);
```

## Best Practices

1. **Handle API errors gracefully** - Wrap LLM calls in try-catch and return meaningful error messages

2. **Respect timeouts** - Check `task.timeout` and abort if exceeded

3. **Track tokens accurately** - Most LLM APIs return token counts in response metadata

4. **Support tool result feedback** - Include tool results in conversation history for multi-turn reasoning

5. **Detect infinite loops** - Use `MAX_ITERATIONS` constant (20) to prevent runaway executions

6. **Preserve conversation context** - Add tool results to message history so the LLM can reason about them

## Contributing

To contribute a new adapter to the AWP project:

1. Create `src/your-agent.ts` extending `BaseAgent`
2. Add export to `src/index.ts`
3. Add any new dependencies to `package.json`
4. Add tests in `src/your-agent.test.ts`
5. Document usage in this file

See `openai-agent.ts` and `anthropic-agent.ts` for reference implementations.
