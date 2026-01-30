import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Current AWP specification version */
export const AWP_VERSION = "0.1.0";

/** Required workspace files */
export const REQUIRED_FILES = ["IDENTITY.md", "SOUL.md"] as const;

/** Optional workspace files */
export const OPTIONAL_FILES = [
  "AGENTS.md",
  "USER.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
] as const;

/** All known workspace files */
export const ALL_WORKSPACE_FILES = [
  ...REQUIRED_FILES,
  ...OPTIONAL_FILES,
] as const;

/** Workspace manifest path */
export const MANIFEST_PATH = ".awp/workspace.json";

/** Memory directory */
export const MEMORY_DIR = "memory";

/** File type to filename mapping */
export const FILE_TYPE_MAP: Record<string, string> = {
  identity: "IDENTITY.md",
  soul: "SOUL.md",
  operations: "AGENTS.md",
  user: "USER.md",
  tools: "TOOLS.md",
  heartbeat: "HEARTBEAT.md",
  bootstrap: "BOOTSTRAP.md",
  "memory-longterm": "MEMORY.md",
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
};
