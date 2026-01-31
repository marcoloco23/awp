import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { REPUTATION_DIR } from "@agent-workspace/core";
import type {
  ReputationProfileFrontmatter,
  ReputationDimension,
} from "@agent-workspace/core";
import { parseWorkspaceFile } from "./frontmatter.js";
import type { WorkspaceFile } from "@agent-workspace/core";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Default EWMA learning rate */
export const DEFAULT_ALPHA = 0.15;

/** Default decay rate per month */
export const DEFAULT_DECAY_RATE = 0.02;

/** Score floor — unknown baseline */
export const SCORE_FLOOR = 0.5;

/** Milliseconds per month (average) */
const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

/**
 * Validate a reputation slug
 */
export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Get the file path for a reputation profile slug
 */
export function slugToProfilePath(
  workspaceRoot: string,
  slug: string
): string {
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
      const parsed =
        await parseWorkspaceFile<ReputationProfileFrontmatter>(
          join(repDir, f)
        );
      if (parsed.frontmatter.type === "reputation-profile") {
        profiles.push(parsed);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return profiles;
}

/**
 * Apply time-based decay to a score.
 * Scores decay toward 0.5 (unknown baseline).
 */
export function computeDecayedScore(
  dim: ReputationDimension,
  now: Date = new Date(),
  decayRate: number = DEFAULT_DECAY_RATE
): number {
  const lastSignalDate = new Date(dim.lastSignal);
  const monthsElapsed =
    (now.getTime() - lastSignalDate.getTime()) / MS_PER_MONTH;

  if (monthsElapsed <= 0) return dim.score;

  const decayFactor = Math.exp(-decayRate * monthsElapsed);

  // Decay toward 0.5 (unknown baseline)
  const decayed = SCORE_FLOOR + (dim.score - SCORE_FLOOR) * decayFactor;

  return Math.round(decayed * 1000) / 1000;
}

/**
 * Update a dimension with a new signal using EWMA.
 */
export function updateDimension(
  existing: ReputationDimension | undefined,
  signalScore: number,
  now: Date = new Date(),
  alpha: number = DEFAULT_ALPHA
): ReputationDimension {
  const timestamp = now.toISOString();

  if (!existing) {
    return {
      score: signalScore,
      confidence: computeConfidence(1),
      sampleSize: 1,
      lastSignal: timestamp,
    };
  }

  // Apply decay to old score before EWMA
  const decayed = computeDecayedScore(existing, now);
  const newScore = alpha * signalScore + (1 - alpha) * decayed;
  const newSampleSize = existing.sampleSize + 1;

  return {
    score: Math.round(newScore * 1000) / 1000,
    confidence: computeConfidence(newSampleSize),
    sampleSize: newSampleSize,
    lastSignal: timestamp,
  };
}

/**
 * Compute confidence from sample size.
 * confidence = 1 - 1/(1 + sampleSize * 0.1)
 */
export function computeConfidence(sampleSize: number): number {
  return Math.round((1 - 1 / (1 + sampleSize * 0.1)) * 100) / 100;
}
