/**
 * AWP Workspace manifest stored at .awp/workspace.json
 * Contains workspace-level metadata and agent configuration.
 */
export interface WorkspaceManifest {
  /** AWP specification version (e.g., "0.4.0") */
  awp: string;
  /** Unique workspace identifier (URN format) */
  id: string;
  /** Human-readable workspace name */
  name: string;
  /** ISO 8601 timestamp when workspace was created */
  created: string;
  /** Agent configuration */
  agent: {
    /** Agent's decentralized identifier (did:key format) */
    did?: string;
    /** Path to identity file (default: "IDENTITY.md") */
    identityFile: string;
  };
  /** List of agent capabilities (e.g., ["coding", "research"]) */
  capabilities?: string[];
  /** Protocol support flags */
  protocols?: {
    /** Agent-to-Agent protocol support */
    a2a?: boolean;
    /** Model Context Protocol support */
    mcp?: boolean;
  };
}

/**
 * Common YAML frontmatter fields shared by all AWP workspace files.
 * Every workspace file (*.md) includes these base fields.
 */
export interface BaseFrontmatter {
  /** AWP specification version */
  awp: string;
  /** File type identifier (e.g., "identity", "soul", "memory-daily") */
  type: string;
  /** ISO 8601 timestamp of last modification */
  lastModified?: string;
  /** DID or identifier of last modifier */
  modifiedBy?: string;
}

/**
 * IDENTITY.md frontmatter - defines the agent's public identity.
 * Contains factual information about what the agent is and can do.
 */
export interface IdentityFrontmatter extends BaseFrontmatter {
  type: "identity";
  /** Decentralized identifier (did:key format) */
  did?: string;
  /** Agent's display name */
  name: string;
  /** What kind of entity this is (e.g., "digital assistant", "coding agent") */
  creature?: string;
  /** Representative emoji */
  emoji?: string;
  /** URL to avatar image */
  avatar?: string;
  /** List of capabilities this agent has */
  capabilities?: string[];
  /** ISO 8601 timestamp when identity was created */
  created: string;
}

/**
 * SOUL.md frontmatter - defines the agent's personality, values, and behavioral constraints.
 * This is who the agent IS, not just what it can do.
 */
export interface SoulFrontmatter extends BaseFrontmatter {
  type: "soul";
  /** Brief personality description */
  vibe?: string;
  /** Core values that guide behavior */
  values?: SoulValue[];
  /** Behavioral boundaries and constraints */
  boundaries?: SoulBoundary[];
  /** Governance rules for human oversight */
  governance?: SoulGovernance;
}

/** A core value that guides agent behavior */
export interface SoulValue {
  /** Unique identifier for this value */
  id: string;
  /** Priority ranking (1 = highest) */
  priority?: number;
  /** Description of what this value means in practice */
  description: string;
}

/** A behavioral boundary or constraint */
export interface SoulBoundary {
  /** Unique identifier for this boundary */
  id: string;
  /** The rule or constraint */
  rule: string;
  /** Severity level: "hard" = never violate, "soft" = prefer to follow */
  severity: "hard" | "soft";
}

/** Governance rules defining what requires human approval */
export interface SoulGovernance {
  /** Actions that always require human approval */
  humanApprovalRequired?: string[];
  /** Actions the agent can take autonomously */
  autonomouslyAllowed?: string[];
}

/**
 * USER.md frontmatter
 */
export interface UserFrontmatter extends BaseFrontmatter {
  type: "user";
  name?: string;
  callSign?: string;
  pronouns?: string;
  timezone?: string;
}

/**
 * AGENTS.md frontmatter
 */
export interface OperationsFrontmatter extends BaseFrontmatter {
  type: "operations";
  sessionStartup?: string[];
  heartbeat?: {
    enabled: boolean;
    intervalMinutes?: number;
    checks?: string[];
  };
  memoryPolicy?: {
    dailyLogs?: boolean;
    longTermCompaction?: boolean;
    compactionInterval?: "daily" | "weekly" | "monthly";
  };
}

/**
 * Daily memory log frontmatter (memory/YYYY-MM-DD.md).
 * Contains structured entries from a single day.
 */
export interface MemoryDailyFrontmatter extends BaseFrontmatter {
  type: "memory-daily";
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Structured memory entries for this day */
  entries?: MemoryEntry[];
}

/** A single memory entry in a daily log */
export interface MemoryEntry {
  /** Time of entry in HH:MM format */
  time?: string;
  /** The memory content */
  content: string;
  /** Tags for categorization and search */
  tags?: string[];
  /** Whether this entry should be preserved during compaction */
  pinned?: boolean;
}

/**
 * MEMORY.md frontmatter
 */
export interface MemoryLongtermFrontmatter extends BaseFrontmatter {
  type: "memory-longterm";
  lastCompacted?: string;
  entryCount?: number;
  pinnedCount?: number;
}

/**
 * TOOLS.md frontmatter
 */
export interface ToolsFrontmatter extends BaseFrontmatter {
  type: "tools";
}

/**
 * HEARTBEAT.md frontmatter
 */
export interface HeartbeatFrontmatter extends BaseFrontmatter {
  type: "heartbeat";
  tasks?: HeartbeatTask[];
}

export interface HeartbeatTask {
  id: string;
  description: string;
  intervalMinutes?: number;
  enabled?: boolean;
}

import type { ArtifactFrontmatter } from "./artifact.js";
import type { ReputationProfileFrontmatter } from "./reputation.js";
import type { DelegationContractFrontmatter } from "./contract.js";
import type { ProjectFrontmatter, TaskFrontmatter } from "./project.js";

/**
 * Union of all frontmatter types
 */
export type AnyFrontmatter =
  | IdentityFrontmatter
  | SoulFrontmatter
  | UserFrontmatter
  | OperationsFrontmatter
  | ToolsFrontmatter
  | HeartbeatFrontmatter
  | MemoryDailyFrontmatter
  | MemoryLongtermFrontmatter
  | ArtifactFrontmatter
  | ReputationProfileFrontmatter
  | DelegationContractFrontmatter
  | ProjectFrontmatter
  | TaskFrontmatter;

/**
 * A parsed AWP workspace file containing YAML frontmatter and markdown body.
 * Generic type T allows type-safe access to specific frontmatter types.
 *
 * @template T - The frontmatter type (extends BaseFrontmatter)
 * @example
 * const identity = await parseWorkspaceFile<IdentityFrontmatter>("IDENTITY.md");
 * console.log(identity.frontmatter.name); // Type-safe access
 */
export interface WorkspaceFile<T extends BaseFrontmatter = BaseFrontmatter> {
  /** Parsed YAML frontmatter */
  frontmatter: T;
  /** Markdown body content (without frontmatter) */
  body: string;
  /** Absolute path to the file */
  filePath: string;
}
