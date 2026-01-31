import { readdir } from "node:fs/promises";
import { join } from "node:path";
import {
  REPUTATION_DIR,
  REPUTATION_EWMA_ALPHA,
  REPUTATION_DECAY_RATE,
  REPUTATION_BASELINE,
} from "@agent-workspace/core";
import type { ReputationProfileFrontmatter } from "@agent-workspace/core";
import type { WorkspaceFile } from "@agent-workspace/core";
import {
  computeConfidence,
  computeDecayedScore,
  updateDimension,
  validateSlug,
  parseWorkspaceFile,
} from "@agent-workspace/utils";

// Re-export from @agent-workspace/utils for backwards compatibility
export { computeConfidence, computeDecayedScore, updateDimension, validateSlug };

// Re-export constants for backwards compatibility
export const DEFAULT_ALPHA = REPUTATION_EWMA_ALPHA;
export const DEFAULT_DECAY_RATE = REPUTATION_DECAY_RATE;
export const SCORE_FLOOR = REPUTATION_BASELINE;

/**
 * Get the file path for a reputation profile slug
 */
export function slugToProfilePath(workspaceRoot: string, slug: string): string {
  return join(workspaceRoot, REPUTATION_DIR, `${slug}.md`);
}

/**
 * Load a reputation profile by slug
 */
export async function loadProfile(
  workspaceRoot: string,
  slug: string
): Promise<WorkspaceFile<ReputationProfileFrontmatter>> {
  const filePath = slugToProfilePath(workspaceRoot, slug);
  return parseWorkspaceFile<ReputationProfileFrontmatter>(filePath);
}

/**
 * List all reputation profiles in the workspace
 */
export async function listProfiles(
  workspaceRoot: string
): Promise<WorkspaceFile<ReputationProfileFrontmatter>[]> {
  const repDir = join(workspaceRoot, REPUTATION_DIR);
  let files: string[];
  try {
    files = await readdir(repDir);
  } catch {
    return [];
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
  const profiles: WorkspaceFile<ReputationProfileFrontmatter>[] = [];

  for (const f of mdFiles) {
    try {
      const parsed = await parseWorkspaceFile<ReputationProfileFrontmatter>(join(repDir, f));
      if (parsed.frontmatter.type === "reputation-profile") {
        profiles.push(parsed);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return profiles;
}
