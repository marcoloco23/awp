import type { BaseFrontmatter } from "./workspace.js";

/**
 * Human governance settings for a swarm
 */
export interface SwarmGovernance {
  /** User ID of the human lead (e.g., 'user:marc') */
  humanLead?: string;
  /** Whether the human lead can veto decisions */
  vetoPower?: boolean;
  /** Auto-escalate to human if confidence below this threshold (0.0-1.0) */
  escalationThreshold?: number;
}

/**
 * A role definition within a swarm with reputation requirements
 */
export interface SwarmRole {
  /** Role name (e.g., 'researcher', 'writer') */
  name: string;
  /** Number of agents needed for this role */
  count: number;
  /** Map of dimension/domain to minimum score threshold */
  minReputation?: Record<string, number>;
  /** DIDs of agents assigned to this role */
  assigned: string[];
  /** Reputation profile slugs of assigned agents */
  assignedSlugs?: string[];
}

/**
 * Swarm frontmatter (swarms/<slug>.md)
 * Multi-agent composition with dynamic role recruitment
 */
export interface SwarmFrontmatter extends BaseFrontmatter {
  type: "swarm";
  /** CDP protocol version */
  cdp: string;
  /** Unique identifier (swarm:<slug>) */
  id: string;
  /** Human-readable swarm name */
  name: string;
  /** The objective this swarm is working toward */
  goal: string;
  /** Swarm lifecycle state */
  status: "recruiting" | "active" | "completed" | "disbanded";
  /** Swarm creation timestamp (ISO 8601) */
  created: string;
  /** Optional human governance settings */
  governance?: SwarmGovernance;
  /** Roles needed for this swarm */
  roles: SwarmRole[];
  /** Optional linked project ID */
  projectId?: string;
  /** Classification tags */
  tags?: string[];
}
