import { readFile, access } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  MANIFEST_PATH,
  REQUIRED_FILES,
  OPTIONAL_FILES,
  AWP_VERSION,
  type WorkspaceManifest,
} from "@agent-workspace/core";
import { parseWorkspaceFile } from "./frontmatter.js";

export interface WorkspaceInfo {
  root: string;
  manifest: WorkspaceManifest;
  files: {
    required: { file: string; exists: boolean; valid: boolean }[];
    optional: { file: string; exists: boolean }[];
  };
}

/**
 * Find workspace root by walking up from cwd looking for .awp/workspace.json
 */
export async function findWorkspaceRoot(startDir?: string): Promise<string | null> {
  let dir = resolve(startDir || process.cwd());
  const root = resolve("/");

  while (dir !== root) {
    const manifestPath = join(dir, MANIFEST_PATH);
    try {
      await access(manifestPath);
      return dir;
    } catch {
      dir = resolve(dir, "..");
    }
  }
  return null;
}

/**
 * Load workspace manifest
 */
export async function loadManifest(workspaceRoot: string): Promise<WorkspaceManifest> {
  const manifestPath = join(workspaceRoot, MANIFEST_PATH);
  const raw = await readFile(manifestPath, "utf-8");
  return JSON.parse(raw) as WorkspaceManifest;
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gather full workspace info for inspection/validation
 */
export async function inspectWorkspace(workspaceRoot: string): Promise<WorkspaceInfo> {
  const manifest = await loadManifest(workspaceRoot);

  const required = await Promise.all(
    REQUIRED_FILES.map(async (file) => {
      const path = join(workspaceRoot, file);
      const exists = await fileExists(path);
      let valid = false;
      if (exists) {
        try {
          const parsed = await parseWorkspaceFile(path);
          valid =
            typeof parsed.frontmatter.awp === "string" &&
            typeof parsed.frontmatter.type === "string";
        } catch {
          valid = false;
        }
      }
      return { file, exists, valid };
    })
  );

  const optional = await Promise.all(
    OPTIONAL_FILES.map(async (file) => {
      const exists = await fileExists(join(workspaceRoot, file));
      return { file, exists };
    })
  );

  return { root: workspaceRoot, manifest, files: { required, optional } };
}

/**
 * Generate a unique workspace ID
 */
export function generateWorkspaceId(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `urn:awp:workspace:${hex}`;
}

/**
 * Create default workspace manifest
 */
export function createDefaultManifest(name: string, _agentName?: string): WorkspaceManifest {
  return {
    awp: AWP_VERSION,
    id: generateWorkspaceId(),
    name,
    created: new Date().toISOString(),
    agent: {
      identityFile: "IDENTITY.md",
    },
    capabilities: [],
    protocols: {
      a2a: true,
      mcp: true,
    },
  };
}
