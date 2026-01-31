import { join } from "node:path";
import {
  REQUIRED_FILES,
  OPTIONAL_FILES,
  AWP_VERSION,
  type WorkspaceManifest,
} from "@agent-workspace/core";
import { findWorkspaceRoot, loadManifest, fileExists } from "@agent-workspace/utils";
import { parseWorkspaceFile } from "./frontmatter.js";

// Re-export from @agent-workspace/utils
export { findWorkspaceRoot, loadManifest, fileExists };

export interface WorkspaceInfo {
  root: string;
  manifest: WorkspaceManifest;
  files: {
    required: { file: string; exists: boolean; valid: boolean }[];
    optional: { file: string; exists: boolean }[];
  };
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
