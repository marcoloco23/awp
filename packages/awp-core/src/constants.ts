import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Current AWP specification version */
export const AWP_VERSION = "0.4.0";

/** Current SMP protocol version */
export const SMP_VERSION = "1.0";

/** Current RDP protocol version */
export const RDP_VERSION = "1.0";

/** Current CDP protocol version */
export const CDP_VERSION = "1.0";

/** Required workspace files */
export const REQUIRED_FILES = ["IDENTITY.md", "SOUL.md"] as const;

/** Optional workspace files */
export const OPTIONAL_FILES = [
  "AGENTS.md",
  "USER.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "MEMORY.md",
] as const;

/** All known workspace files */
export const ALL_WORKSPACE_FILES = [...REQUIRED_FILES, ...OPTIONAL_FILES] as const;

/** Workspace manifest path */
export const MANIFEST_PATH = ".awp/workspace.json";

/** Memory directory */
export const MEMORY_DIR = "memory";

/** Artifacts directory */
export const ARTIFACTS_DIR = "artifacts";

/** Reputation profiles directory */
export const REPUTATION_DIR = "reputation";

/** Delegation contracts directory */
export const CONTRACTS_DIR = "contracts";

/** Projects directory */
export const PROJECTS_DIR = "projects";

/** Swarms directory */
export const SWARMS_DIR = "swarms";

/** File type to filename mapping */
export const FILE_TYPE_MAP: Record<string, string> = {
  identity: "IDENTITY.md",
  soul: "SOUL.md",
  operations: "AGENTS.md",
  user: "USER.md",
  tools: "TOOLS.md",
  heartbeat: "HEARTBEAT.md",
  "memory-longterm": "MEMORY.md",
  "knowledge-artifact": "artifacts/",
  "reputation-profile": "reputation/",
  "delegation-contract": "contracts/",
  project: "projects/",
  task: "projects/",
  swarm: "swarms/",
};

/**
 * Absolute path to the schemas directory bundled with @agent-workspace/core.
 * Works in monorepo (dev) and when installed from npm.
 */
export const SCHEMAS_DIR = join(__dirname, "..", "schemas");

/**
 * Resolve absolute path to a specific schema file.
 */
export function getSchemaPath(schemaFileName: string): string {
  return join(SCHEMAS_DIR, schemaFileName);
}

/** Schema file mapping */
export const SCHEMA_MAP: Record<string, string> = {
  identity: "identity.schema.json",
  soul: "soul.schema.json",
  operations: "operations.schema.json",
  user: "user.schema.json",
  tools: "tools.schema.json",
  heartbeat: "heartbeat.schema.json",
  "memory-daily": "memory-daily.schema.json",
  "memory-longterm": "memory-longterm.schema.json",
  "knowledge-artifact": "knowledge-artifact.schema.json",
  "reputation-profile": "reputation-profile.schema.json",
  "delegation-contract": "delegation-contract.schema.json",
  project: "project.schema.json",
  task: "task.schema.json",
  swarm: "swarm.schema.json",
};

// ============================================================================
// Reputation Constants (RDP)
// ============================================================================

/** EWMA learning rate for reputation updates */
export const REPUTATION_EWMA_ALPHA = 0.15;

/** Monthly decay rate for reputation scores */
export const REPUTATION_DECAY_RATE = 0.02;

/** Baseline score that scores decay toward (unknown state) */
export const REPUTATION_BASELINE = 0.5;

/** Milliseconds per average month (30.44 days) */
export const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
