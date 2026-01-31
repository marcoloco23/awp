/**
 * Agent package constants.
 *
 * Centralized configuration values for the agent runtime.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Directory Names
// ─────────────────────────────────────────────────────────────────────────────

/** Default directory for society containers */
export const SOCIETIES_DIR = "societies";

// ─────────────────────────────────────────────────────────────────────────────
// Default Models
// ─────────────────────────────────────────────────────────────────────────────

/** Default OpenAI model for agent tasks */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/** Default Anthropic model for agent tasks */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

/** Default max tokens for Anthropic responses */
export const DEFAULT_ANTHROPIC_MAX_TOKENS = 4096;

// ─────────────────────────────────────────────────────────────────────────────
// Provider Names
// ─────────────────────────────────────────────────────────────────────────────

/** Supported LLM providers */
export const PROVIDERS = {
  OPENAI: "openai",
  ANTHROPIC: "anthropic",
} as const;

export type Provider = (typeof PROVIDERS)[keyof typeof PROVIDERS];

// ─────────────────────────────────────────────────────────────────────────────
// Pricing (per million tokens)
// ─────────────────────────────────────────────────────────────────────────────

/** Token pricing per million tokens */
export const PRICING = {
  openai: {
    input: 0.15,
    output: 0.6,
  },
  anthropic: {
    input: 3,
    output: 15,
  },
} as const;

/**
 * Estimate cost for a given number of tokens.
 * Assumes 50/50 split between input and output tokens.
 */
export function estimateCost(provider: Provider, totalTokens: number): number {
  const pricing = PRICING[provider];
  const inputTokens = totalTokens * 0.5;
  const outputTokens = totalTokens * 0.5;
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}
