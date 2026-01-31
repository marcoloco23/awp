/**
 * @agent-workspace/agent
 *
 * Agent runtime for AWP experiments — framework-agnostic adapter pattern
 * with OpenAI implementation.
 */

// Core types
export * from "./types.js";

// Agent implementations
export { OpenAIAgent } from "./openai-agent.js";

// Tools
export { AWP_TOOLS, executeToolCall } from "./tools.js";

// Orchestration
export { ExperimentOrchestrator } from "./orchestrator.js";
export { MetricsCollector } from "./metrics.js";
export { SocietyManager, parseManifesto } from "./society.js";
