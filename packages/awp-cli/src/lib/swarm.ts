import { readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SWARMS_DIR } from "@agent-workspace/core";
import type { SwarmFrontmatter, WorkspaceFile } from "@agent-workspace/core";
import { parseWorkspaceFile } from "./frontmatter.js";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validate a swarm slug
 */
export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Get the file path for a swarm slug
 */
export function slugToSwarmPath(workspaceRoot: string, slug: string): string {
  return join(workspaceRoot, SWARMS_DIR, `${slug}.md`);
}

/**
 * Load a swarm by slug
 */
export async function loadSwarm(
  workspaceRoot: string,
  slug: string
): Promise<WorkspaceFile<SwarmFrontmatter>> {
  const filePath = slugToSwarmPath(workspaceRoot, slug);
  return parseWorkspaceFile<SwarmFrontmatter>(filePath);
}

/**
 * List all swarms in the workspace
 */
export async function listSwarms(
  workspaceRoot: string
): Promise<WorkspaceFile<SwarmFrontmatter>[]> {
  const swarmsDir = join(workspaceRoot, SWARMS_DIR);
  let entries: string[];
  try {
    entries = await readdir(swarmsDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
  const swarms: WorkspaceFile<SwarmFrontmatter>[] = [];

  for (const f of mdFiles) {
    try {
      const parsed = await parseWorkspaceFile<SwarmFrontmatter>(join(swarmsDir, f));
      if (parsed.frontmatter.type === "swarm") {
        swarms.push(parsed);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return swarms;
}

/**
 * Ensure the swarms directory exists
 */
export async function ensureSwarmsDir(workspaceRoot: string): Promise<void> {
  const swarmsDir = join(workspaceRoot, SWARMS_DIR);
  await mkdir(swarmsDir, { recursive: true });
}
