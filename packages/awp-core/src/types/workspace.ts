/**
 * AWP Workspace manifest (.awp/workspace.json)
 */
export interface WorkspaceManifest {
  awp: string;
  id: string;
  name: string;
  created: string;
  agent: {
    did?: string;
    identityFile: string;
  };
  capabilities?: string[];
  protocols?: {
    a2a?: boolean;
    mcp?: boolean;
  };
}

/**
 * Common frontmatter fields shared by all workspace files
 */
export interface BaseFrontmatter {
  awp: string;
  type: string;
  lastModified?: string;
  modifiedBy?: string;
}

/**
 * IDENTITY.md frontmatter
 */
export interface IdentityFrontmatter extends BaseFrontmatter {
  type: "identity";
  did?: string;
  name: string;
  creature?: string;
  emoji?: string;
  avatar?: string;
  capabilities?: string[];
  created: string;
}

/**
 * SOUL.md frontmatter
 */
export interface SoulFrontmatter extends BaseFrontmatter {
  type: "soul";
  vibe?: string;
  values?: SoulValue[];
  boundaries?: SoulBoundary[];
  governance?: SoulGovernance;
}

export interface SoulValue {
  id: string;
  priority?: number;
  description: string;
}

export interface SoulBoundary {
  id: string;
  rule: string;
  severity: "hard" | "soft";
}

export interface SoulGovernance {
  humanApprovalRequired?: string[];
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
 * Daily memory log frontmatter
 */
export interface MemoryDailyFrontmatter extends BaseFrontmatter {
  type: "memory-daily";
  date: string;
  entries?: MemoryEntry[];
}

export interface MemoryEntry {
  time?: string;
  content: string;
  tags?: string[];
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
  | DelegationContractFrontmatter;

/**
 * A parsed workspace file — frontmatter + markdown body
 */
export interface WorkspaceFile<T extends BaseFrontmatter = BaseFrontmatter> {
  frontmatter: T;
  body: string;
  filePath: string;
}
