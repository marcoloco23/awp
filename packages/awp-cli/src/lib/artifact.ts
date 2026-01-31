import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ARTIFACTS_DIR } from "@agent-workspace/core";
import type { ArtifactFrontmatter } from "@agent-workspace/core";
import type { WorkspaceFile } from "@agent-workspace/core";
import { validateSlug, parseWorkspaceFile, getAgentDid } from "@agent-workspace/utils";

// Re-export from @agent-workspace/utils for backwards compatibility
export { validateSlug, getAgentDid };

/**
 * Convert a slug to an artifact ID
 */
export function idFromSlug(slug: string): string {
  return `artifact:${slug}`;
}

/**
 * Extract slug from an artifact ID
 */
export function slugFromId(id: string): string {
  return id.replace(/^artifact:/, "");
}

/**
 * Get the file path for an artifact slug
 */
export function slugToPath(workspaceRoot: string, slug: string): string {
  return join(workspaceRoot, ARTIFACTS_DIR, `${slug}.md`);
}

/**
 * Load an artifact by slug
 */
export async function loadArtifact(
  workspaceRoot: string,
  slug: string
): Promise<WorkspaceFile<ArtifactFrontmatter>> {
  const filePath = slugToPath(workspaceRoot, slug);
  return parseWorkspaceFile<ArtifactFrontmatter>(filePath);
}

/**
 * List all artifacts in the workspace
 */
export async function listArtifacts(
  workspaceRoot: string
): Promise<WorkspaceFile<ArtifactFrontmatter>[]> {
  const artifactsDir = join(workspaceRoot, ARTIFACTS_DIR);
  let files: string[];
  try {
    files = await readdir(artifactsDir);
  } catch {
    return [];
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
  const artifacts: WorkspaceFile<ArtifactFrontmatter>[] = [];

  for (const f of mdFiles) {
    try {
      const parsed = await parseWorkspaceFile<ArtifactFrontmatter>(join(artifactsDir, f));
      if (parsed.frontmatter.type === "knowledge-artifact") {
        artifacts.push(parsed);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return artifacts;
}
