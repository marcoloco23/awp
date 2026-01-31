# @agent-workspace/agent

Agent runtime for AWP experiments — a framework-agnostic adapter pattern with OpenAI and Anthropic implementations.

## Overview

This package provides the agent runtime infrastructure for running AWP experiments. It uses an adapter pattern that allows different LLM backends (OpenAI, Anthropic, or custom) to be swapped while maintaining the same experiment orchestration logic.

## Quick Start

```bash
# Install
npm install @agent-workspace/agent

# Set API key
export OPENAI_API_KEY=sk-xxx
# Or for Anthropic:
export ANTHROPIC_API_KEY=sk-ant-xxx
```

```typescript
import { 
  OpenAIAgent, 
  AnthropicAgent,
  ExperimentOrchestrator, 
  SocietyManager,
  MetricsCollector,
  parseManifesto 
} from '@agent-workspace/agent';

// Parse manifesto
const manifesto = await parseManifesto('./MANIFESTO.md');

// Create society
const manager = new SocietyManager('./societies');
const society = await manager.createSociety('test-001', manifesto.id, 3);

// Create agents
const agents = society.agents.map((workspace, i) => 
  new OpenAIAgent(`agent-${i + 1}`, workspace, 'gpt-4o-mini')
);

// Initialize agents
for (const agent of agents) {
  await agent.getIdentity();
}

// Run experiment
const metrics = new MetricsCollector();
const orchestrator = new ExperimentOrchestrator(manifesto, agents, metrics, society);
const results = await orchestrator.runExperiment(5); // 5 cycles

console.log(`Success rate: ${(results.aggregateMetrics.overallSuccessRate * 100).toFixed(1)}%`);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Experiment Orchestrator                   │
│         (creates contracts, runs cycles, collects metrics)  │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │  OpenAI   │   │ Anthropic │   │  Custom   │
    │   Agent   │   │   Agent   │   │  (yours)  │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                ┌───────────────────┐
                │   AWP Tools       │
                │   (7 operations)  │
                └───────────────────┘
```

## Agent Implementations

### OpenAIAgent

Uses OpenAI's function calling with models like `gpt-4o-mini`, `gpt-4o`, etc.

```typescript
import { OpenAIAgent } from '@agent-workspace/agent';

const agent = new OpenAIAgent(
  'agent-01',           // id
  './workspace',        // workspace path
  'gpt-4o-mini',        // model (optional)
  process.env.OPENAI_API_KEY // apiKey (optional)
);
```

### AnthropicAgent

Uses Anthropic's tool_use with models like `claude-sonnet-4-20250514`, `claude-3-haiku`, etc.

```typescript
import { AnthropicAgent } from '@agent-workspace/agent';

const agent = new AnthropicAgent(
  'agent-01',           // id
  './workspace',        // workspace path
  'claude-sonnet-4-20250514', // model (optional)
  process.env.ANTHROPIC_API_KEY // apiKey (optional)
);
```

### Custom Agents

Implement the `AgentAdapter` interface or extend `BaseAgent`:

```typescript
import { BaseAgent, AgentTask, TaskResult } from '@agent-workspace/agent';

class MyCustomAgent extends BaseAgent {
  async executeTask(task: AgentTask): Promise<TaskResult> {
    const systemPrompt = await this.buildSystemPrompt(task);
    // ... your LLM integration
  }
}
```

See [AGENT_ADAPTER.md](./AGENT_ADAPTER.md) for full documentation.

## Core Interfaces

### AgentAdapter

```typescript
interface AgentAdapter {
  readonly id: string;
  readonly workspace: string;
  readonly did: string;
  
  executeTask(task: AgentTask): Promise<TaskResult>;
  getReputation(): Promise<AgentReputation>;
  getIdentity(): Promise<{ name: string; did: string; role?: string }>;
}
```

### AgentTask

```typescript
interface AgentTask {
  contractId: string;
  description: string;
  tools: ToolDefinition[];
  timeout?: number;
  outputFormat?: string;
  outputSlug?: string;
}
```

### TaskResult

```typescript
interface TaskResult {
  success: boolean;
  output?: string;
  toolCalls: ToolCall[];
  tokens: { input: number; output: number };
  durationMs: number;
  error?: string;
  rawResponse?: string;
}
```

## Available Tools

Agents have access to 7 AWP operations:

| Tool | Description |
|------|-------------|
| `awp_artifact_read` | Read a knowledge artifact |
| `awp_artifact_write` | Write/update an artifact |
| `awp_artifact_list` | List all artifacts |
| `awp_contract_accept` | Accept a delegation contract |
| `awp_contract_complete` | Mark contract complete |
| `awp_reputation_query` | Query agent reputation |
| `task_complete` | Signal task completion |

## CLI Integration

The `awp` CLI provides experiment commands:

```bash
# Create a society
awp experiment society create --manifesto MANIFESTO.md --agents 3

# Run experiment with OpenAI (default)
awp experiment run -s <society-id> -c 5 -m MANIFESTO.md

# Run with Anthropic
awp experiment run -s <society-id> -c 5 -m MANIFESTO.md --provider anthropic

# List societies
awp experiment list

# Show results
awp experiment show <society-id>
```

## Environment Variables

| Variable | Description | Required For |
|----------|-------------|--------------|
| `OPENAI_API_KEY` | OpenAI API key | OpenAIAgent |
| `ANTHROPIC_API_KEY` | Anthropic API key | AnthropicAgent |

## Exports

```typescript
// Types
export * from './types';

// Base class
export { BaseAgent, MAX_ITERATIONS, DEFAULT_TIMEOUT_MS } from './base-agent';

// Agent implementations
export { OpenAIAgent } from './openai-agent';
export { AnthropicAgent } from './anthropic-agent';

// Tools
export { AWP_TOOLS, executeToolCall } from './tools';

// Orchestration
export { ExperimentOrchestrator } from './orchestrator';
export { MetricsCollector } from './metrics';
export { SocietyManager, parseManifesto } from './society';
```

## License

Apache-2.0
