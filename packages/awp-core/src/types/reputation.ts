import type { BaseFrontmatter } from "./workspace.js";

/**
 * A single reputation dimension score
 */
export interface ReputationDimension {
  score: number;
  confidence: number;
  sampleSize: number;
  lastSignal: string;
}

/**
 * An atomic reputation observation
 */
export interface ReputationSignal {
  source: string;
  dimension: string;
  domain?: string;
  score: number;
  timestamp: string;
  evidence?: string;
  message?: string;
}

/**
 * Reputation profile frontmatter (reputation/<slug>.md)
 */
export interface ReputationProfileFrontmatter extends BaseFrontmatter {
  type: "reputation-profile";
  rdp: string;
  id: string;
  agentDid: string;
  agentName: string;
  lastUpdated: string;
  dimensions?: Record<string, ReputationDimension>;
  domainCompetence?: Record<string, ReputationDimension>;
  signals: ReputationSignal[];
}
