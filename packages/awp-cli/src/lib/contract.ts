import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { CONTRACTS_DIR } from "@agent-workspace/core";
import type {
  DelegationContractFrontmatter,
  ReputationSignal,
} from "@agent-workspace/core";
import { parseWorkspaceFile } from "./frontmatter.js";
import type { WorkspaceFile } from "@agent-workspace/core";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validate a contract slug
 */
export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Get the file path for a contract slug
 */
export function slugToContractPath(
  workspaceRoot: string,
  slug: string
): string {
  return join(workspaceRoot, CONTRACTS_DIR, `${slug}.md`);
}

/**
 * Load a contract by slug
 */
export async function loadContract(
  workspaceRoot: string,
  slug: string
): Promise<WorkspaceFile<DelegationContractFrontmatter>> {
  const filePath = slugToContractPath(workspaceRoot, slug);
  return parseWorkspaceFile<DelegationContractFrontmatter>(filePath);
}

/**
 * List all contracts in the workspace
 */
export async function listContracts(
  workspaceRoot: string
): Promise<WorkspaceFile<DelegationContractFrontmatter>[]> {
  const contractsDir = join(workspaceRoot, CONTRACTS_DIR);
  let files: string[];
  try {
    files = await readdir(contractsDir);
  } catch {
    return [];
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
  const contracts: WorkspaceFile<DelegationContractFrontmatter>[] = [];

  for (const f of mdFiles) {
    try {
      const parsed =
        await parseWorkspaceFile<DelegationContractFrontmatter>(
          join(contractsDir, f)
        );
      if (parsed.frontmatter.type === "delegation-contract") {
        contracts.push(parsed);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return contracts;
}

/**
 * Evaluate a contract: compute weighted score and generate reputation signals.
 * Returns the weighted score and the generated signals.
 */
export function evaluateContract(
  contract: DelegationContractFrontmatter,
  scores: Record<string, number>,
  evaluatorDid: string,
  now: Date = new Date()
): { weightedScore: number; signals: ReputationSignal[] } {
  const { criteria } = contract.evaluation;

  // Compute weighted score
  let weightedScore = 0;
  for (const [criterion, weight] of Object.entries(criteria)) {
    const score = scores[criterion];
    if (score === undefined) {
      throw new Error(`Missing score for criterion: ${criterion}`);
    }
    weightedScore += weight * score;
  }
  weightedScore = Math.round(weightedScore * 1000) / 1000;

  const timestamp = now.toISOString();
  const evidence = contract.id;

  // Generate reputation signals
  const signals: ReputationSignal[] = [
    {
      source: evaluatorDid,
      dimension: "reliability",
      score: weightedScore,
      timestamp,
      evidence,
      message: `Contract evaluation: ${contract.task.description}`,
    },
  ];

  return { weightedScore, signals };
}
