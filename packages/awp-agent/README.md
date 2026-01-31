# @agent-workspace/agent

Agent runtime for AWP experiments — a framework-agnostic adapter pattern with an OpenAI implementation.

## Overview

This package provides the agent runtime infrastructure for running AWP experiments. It uses an adapter pattern that allows different LLM backends (OpenAI, Anthropic, moltbot/pi-coding-agent) to be swapped while maintaining the same experiment orchestration logic.

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
    │  OpenAI   │   │ pi-coding │   │  moltbot  │
    │   Agent   │   │   -agent  │   │  (future) │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                ┌───────────────────┐
                │   AWP MCP Tools   │
                │   (awp-cli/lib)   │
                └───────────────────┘
```

## Installation

```bash
npm install @agent-workspace/agent
```

## Usage

```typescript
import { OpenAIAgent, ExperimentOrchestrator, MetricsCollector } from '@agent-workspace/agent';

// Create agents with their workspaces
const agents = [
  new OpenAIAgent('agent-1', './societies/test/agent-1', 'gpt-4o-mini'),
  new OpenAIAgent('agent-2', './societies/test/agent-2', 'gpt-4o-mini'),
  new OpenAIAgent('agent-3', './societies/test/agent-3', 'gpt-4o-mini'),
];

// Create orchestrator
const metrics = new MetricsCollector();
const orchestrator = new ExperimentOrchestrator(manifesto, agents, metrics);

// Run experiment
const results = await orchestrator.runExperiment(10); // 10 cycles
console.log(results);
```

## Core Interfaces

### AgentAdapter

```typescript
interface AgentAdapter {
  id: string;
  workspace: string;
  executeTask(task: AgentTask): Promise<TaskResult>;
  getReputation(): Promise<ReputationProfile>;
}
```

### AgentTask

```typescript
interface AgentTask {
  contractId: string;
  description: string;
  tools: ToolDefinition[];
  timeout?: number;
}
```

## Environment Variables

- `OPENAI_API_KEY` — OpenAI API key for the OpenAI agent implementation

## License

Apache-2.0
