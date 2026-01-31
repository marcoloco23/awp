/**
 * Core types for the AWP agent runtime.
 *
 * Uses an adapter pattern to support multiple LLM backends while maintaining
 * consistent experiment orchestration.
 */

import type {
  ReputationProfileFrontmatter,
  ReputationDimension,
  DelegationContractFrontmatter,
} from "@agent-workspace/core";

// ─────────────────────────────────────────────────────────────────────────────
// Tool Types (OpenAI function calling format)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * JSON Schema for tool parameters.
 * Uses index signature for OpenAI SDK compatibility.
 */
export interface ToolParameterSchema {
  type: "object";
  properties: Record<
    string,
    {
      type: string;
      description?: string;
      enum?: string[];
    }
  >;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Tool definition in OpenAI function calling format
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
}

/**
 * A tool call made by the LLM
 */
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  error?: string;
  durationMs?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A task assigned to an agent, typically from a delegation contract
 */
export interface AgentTask {
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

/**
 * Result of executing a task
 */
export interface TaskResult {
  /** Whether the task completed successfully */
  success: boolean;
  /** Task output (e.g., artifact content, message) */
  output?: string;
  /** All tool calls made during execution */
  toolCalls: ToolCall[];
  /** Token usage */
  tokens: {
    input: number;
    output: number;
  };
  /** Execution time in milliseconds */
  durationMs: number;
  /** Error message if task failed */
  error?: string;
  /** Raw LLM response for debugging */
  rawResponse?: string;
}

/**
 * Simplified reputation profile for agent queries
 */
export interface AgentReputation {
  agentDid: string;
  agentName: string;
  dimensions: Record<string, ReputationDimension>;
  overallScore: number;
}

/**
 * Agent adapter interface — implement this for different LLM backends
 */
export interface AgentAdapter {
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

// ─────────────────────────────────────────────────────────────────────────────
// Experiment Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Manifesto configuration (parsed from MANIFESTO.md frontmatter)
 */
export interface ManifestoConfig {
  id: string;
  name: string;
  version: string;
  /** Value weights (e.g., fidelity-to-reality: 0.30) */
  values: Record<string, number>;
  /** Fitness function weights */
  fitness: Record<string, number>;
  /** Purity dimension weights */
  purity: Record<string, number>;
  /** Resource constraints */
  constraints: {
    maxAgents: number;
    maxConcurrentTasks: number;
    maxContractsPerAgent: number;
    taskBudgetPerCycle: number;
    trustBudget: number;
  };
  /** Governance rules */
  governance: {
    humanApprovalRequired: string[];
    escalationThreshold: number;
    vetoPower: boolean;
  };
  /** Agent lifecycle rules */
  lifecycle: {
    birthRequires: string[];
    deathTriggers: Array<{
      condition: string;
      action: string;
    }>;
  };
  /** Anti-pattern detectors */
  antiPatterns: Array<{
    id: string;
    detector: string;
    penalty: number;
  }>;
  /** Success criteria for experiment evaluation */
  successCriteria: Array<{
    id: string;
    metric: string;
    threshold?: number;
    direction?: "increasing" | "decreasing";
  }>;
}

/**
 * Result of a single experiment cycle
 */
export interface CycleResult {
  /** Cycle number (0-indexed) */
  cycleNumber: number;
  /** ISO 8601 timestamp when cycle started */
  startedAt: string;
  /** ISO 8601 timestamp when cycle ended */
  endedAt: string;
  /** Contracts created this cycle */
  contractsCreated: string[];
  /** Tasks executed this cycle */
  tasksExecuted: Array<{
    contractId: string;
    agentId: string;
    result: TaskResult;
  }>;
  /** Reputation changes this cycle */
  reputationChanges: Array<{
    agentId: string;
    dimension: string;
    oldScore: number;
    newScore: number;
    delta: number;
  }>;
  /** Aggregate metrics for this cycle */
  metrics: CycleMetrics;
}

/**
 * Metrics collected during a cycle
 */
export interface CycleMetrics {
  /** Total tasks attempted */
  tasksAttempted: number;
  /** Tasks completed successfully */
  tasksSucceeded: number;
  /** Tasks that failed */
  tasksFailed: number;
  /** Success rate (0.0 to 1.0) */
  successRate: number;
  /** Total tokens used (input + output) */
  totalTokens: number;
  /** Total execution time in milliseconds */
  totalDurationMs: number;
  /** Average task duration */
  avgTaskDurationMs: number;
  /** Anti-patterns detected */
  antiPatternsDetected: Array<{
    patternId: string;
    agentId: string;
    penalty: number;
  }>;
}

/**
 * Complete experiment result
 */
export interface ExperimentResult {
  /** Experiment identifier */
  experimentId: string;
  /** Manifesto used */
  manifestoId: string;
  /** Society identifier */
  societyId: string;
  /** ISO 8601 timestamp when experiment started */
  startedAt: string;
  /** ISO 8601 timestamp when experiment ended */
  endedAt: string;
  /** Total cycles run */
  totalCycles: number;
  /** Results for each cycle */
  cycles: CycleResult[];
  /** Final reputation state for all agents */
  finalReputations: Record<string, AgentReputation>;
  /** Aggregate metrics across all cycles */
  aggregateMetrics: {
    totalTasks: number;
    totalSuccesses: number;
    totalFailures: number;
    overallSuccessRate: number;
    totalTokens: number;
    totalDurationMs: number;
    avgCycleDurationMs: number;
  };
  /** Success criteria evaluation */
  successCriteriaResults: Array<{
    criterionId: string;
    met: boolean;
    actualValue: number;
    threshold: number;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Society Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Society container configuration
 */
export interface SocietyConfig {
  /** Society identifier (e.g., "purification-001") */
  id: string;
  /** Manifesto ID this society follows */
  manifestoId: string;
  /** Path to society directory */
  path: string;
  /** ISO 8601 timestamp when society was created */
  createdAt: string;
  /** Society status */
  status: "active" | "paused" | "archived";
  /** Agent workspace paths */
  agents: string[];
  /** Current cycle number */
  currentCycle: number;
  /** Random seed for reproducibility */
  seed?: number;
}

// Re-export core types that are commonly used
export type { ReputationProfileFrontmatter, DelegationContractFrontmatter };
