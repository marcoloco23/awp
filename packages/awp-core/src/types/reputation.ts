import type { BaseFrontmatter } from "./workspace.js";

/**
 * A single reputation dimension score with confidence tracking.
 * Scores are updated via EWMA (Exponentially Weighted Moving Average)
 * and decay toward 0.5 (baseline) over time without new signals.
 */
export interface ReputationDimension {
  /** Current score (0.0 to 1.0, decays toward 0.5) */
  score: number;
  /** Confidence level based on sample size (0.0 to 1.0) */
  confidence: number;
  /** Number of signals received for this dimension */
  sampleSize: number;
  /** ISO 8601 timestamp of the last signal */
  lastSignal: string;
}

/**
 * An atomic reputation observation from one agent about another.
 * Signals are the raw data that feed into reputation scores.
 */
export interface ReputationSignal {
  /** DID of the agent providing this signal */
  source: string;
  /** Dimension being evaluated (e.g., "reliability", "epistemic-hygiene") */
  dimension: string;
  /** Optional domain for domain-specific competence */
  domain?: string;
  /** Score for this observation (0.0 to 1.0) */
  score: number;
  /** ISO 8601 timestamp when signal was recorded */
  timestamp: string;
  /** Reference to evidence (e.g., artifact ID, contract ID) */
  evidence?: string;
  /** Human-readable explanation */
  message?: string;
}

/**
 * Reputation profile frontmatter (reputation/<slug>.md).
 * Tracks multi-dimensional reputation for an agent using RDP (Reputation & Delegation Protocol).
 */
export interface ReputationProfileFrontmatter extends BaseFrontmatter {
  type: "reputation-profile";
  /** RDP protocol version */
  rdp: string;
  /** Profile identifier (format: "reputation:<slug>") */
  id: string;
  /** DID of the agent this profile tracks */
  agentDid: string;
  /** Display name of the tracked agent */
  agentName: string;
  /** ISO 8601 timestamp of last update */
  lastUpdated: string;
  /** Standard reputation dimensions (reliability, epistemic-hygiene, coordination) */
  dimensions?: Record<string, ReputationDimension>;
  /** Domain-specific competence scores */
  domainCompetence?: Record<string, ReputationDimension>;
  /** Full history of reputation signals */
  signals: ReputationSignal[];
}
