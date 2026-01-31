/**
 * @agent-workspace/agent
 *
 * Agent runtime for AWP experiments — framework-agnostic adapter pattern
 * with OpenAI and Anthropic implementations.
 */

// Constants
export * from "./constants.js";

// Core types
export * from "./types.js";

// Base agent class
export { BaseAgent, MAX_ITERATIONS, DEFAULT_TIMEOUT_MS } from "./base-agent.js";

// Agent implementations
export { OpenAIAgent } from "./openai-agent.js";
export { AnthropicAgent } from "./anthropic-agent.js";

// Tools
export { AWP_TOOLS, executeToolCall } from "./tools.js";

// Orchestration
export { ExperimentOrchestrator } from "./orchestrator.js";
export { MetricsCollector } from "./metrics.js";
export { SocietyManager, parseManifesto } from "./society.js";
