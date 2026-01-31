/**
 * Swarm recruitment logic for finding and assigning qualified agents to roles.
 */

import type {
  SwarmRole,
  SwarmFrontmatter,
  ReputationProfileFrontmatter,
  ReputationDimension,
} from "@agent-workspace/core";
import { computeDecayedScore } from "./reputation.js";

/**
 * A candidate agent for a swarm role with qualification status
 */
export interface RecruitmentCandidate {
  /** Reputation profile slug */
  slug: string;
  /** Agent DID */
  did: string;
  /** Agent name */
  name: string;
  /** Decayed scores for relevant dimensions */
  scores: Record<string, number>;
  /** Whether the agent meets all minimum requirements */
  qualifies: boolean;
  /** Dimensions/domains where the agent is below threshold */
  gaps: string[];
}

/**
 * Result of auto-recruitment for a swarm
 */
export interface RecruitmentResult {
  /** Role name */
  role: string;
  /** DIDs of agents assigned */
  assigned: string[];
  /** Slugs of agents assigned */
  assignedSlugs: string[];
  /** Number of slots still unfilled */
  unfilled: number;
}

/**
 * Get the decayed score for a dimension from a reputation profile.
 *
 * @param profile - Reputation profile frontmatter
 * @param dimension - Dimension name or "domain-competence:<domain>"
 * @param now - Current date for decay calculation
 * @returns Decayed score or null if dimension not found
 */
function getDimensionScore(
  profile: ReputationProfileFrontmatter,
  dimension: string,
  now: Date
): number | null {
  // Handle domain-competence format
  if (dimension.startsWith("domain-competence:")) {
    const domain = dimension.slice("domain-competence:".length);
    const dim = profile.domainCompetence?.[domain];
    if (!dim) return null;
    return computeDecayedScore(dim, now);
  }

  // Standard dimension
  const dim = profile.dimensions?.[dimension];
  if (!dim) return null;
  return computeDecayedScore(dim, now);
}

/**
 * Find candidates for a swarm role from available reputation profiles.
 * Returns all candidates sorted by qualification (qualified first, then by average score).
 *
 * @param role - The swarm role to find candidates for
 * @param profiles - Available reputation profiles
 * @param now - Current date for decay calculation
 * @returns Array of candidates with qualification status
 */
export function findCandidatesForRole(
  role: SwarmRole,
  profiles: ReputationProfileFrontmatter[],
  now: Date = new Date()
): RecruitmentCandidate[] {
  const candidates: RecruitmentCandidate[] = [];

  for (const profile of profiles) {
    // Skip if already assigned to this role
    if (role.assigned.includes(profile.agentDid)) {
      continue;
    }

    const scores: Record<string, number> = {};
    const gaps: string[] = [];
    let qualifies = true;

    // Check each minimum reputation requirement
    if (role.minReputation) {
      for (const [dimension, minScore] of Object.entries(role.minReputation)) {
        const score = getDimensionScore(profile, dimension, now);

        if (score !== null) {
          scores[dimension] = Math.round(score * 100) / 100;
          if (score < minScore) {
            gaps.push(dimension);
            qualifies = false;
          }
        } else {
          // Missing dimension means not qualified
          scores[dimension] = 0;
          gaps.push(dimension);
          qualifies = false;
        }
      }
    }

    candidates.push({
      slug: profile.id.replace("reputation:", ""),
      did: profile.agentDid,
      name: profile.agentName,
      scores,
      qualifies,
      gaps,
    });
  }

  // Sort: qualified first, then by average score descending
  candidates.sort((a, b) => {
    if (a.qualifies !== b.qualifies) {
      return a.qualifies ? -1 : 1;
    }
    const avgA =
      Object.values(a.scores).length > 0
        ? Object.values(a.scores).reduce((sum, s) => sum + s, 0) / Object.values(a.scores).length
        : 0;
    const avgB =
      Object.values(b.scores).length > 0
        ? Object.values(b.scores).reduce((sum, s) => sum + s, 0) / Object.values(b.scores).length
        : 0;
    return avgB - avgA;
  });

  return candidates;
}

/**
 * Auto-recruit agents to unfilled roles in a swarm.
 * Assigns the best qualified candidates to each role until filled or no more candidates.
 *
 * @param swarm - The swarm to recruit for
 * @param profiles - Available reputation profiles
 * @param now - Current date for decay calculation
 * @returns Array of recruitment results for each role
 */
export function autoRecruitSwarm(
  swarm: SwarmFrontmatter,
  profiles: ReputationProfileFrontmatter[],
  now: Date = new Date()
): RecruitmentResult[] {
  const results: RecruitmentResult[] = [];
  const usedDids = new Set<string>();

  // Collect already assigned agents
  for (const role of swarm.roles) {
    for (const did of role.assigned) {
      usedDids.add(did);
    }
  }

  for (const role of swarm.roles) {
    const currentCount = role.assigned.length;
    const neededCount = role.count - currentCount;

    if (neededCount <= 0) {
      results.push({
        role: role.name,
        assigned: [],
        assignedSlugs: [],
        unfilled: 0,
      });
      continue;
    }

    // Filter profiles to exclude already used agents
    const availableProfiles = profiles.filter((p) => !usedDids.has(p.agentDid));
    const candidates = findCandidatesForRole(role, availableProfiles, now);

    // Take qualified candidates up to needed count
    const qualified = candidates.filter((c) => c.qualifies);
    const toAssign = qualified.slice(0, neededCount);

    const assignedDids = toAssign.map((c) => c.did);
    const assignedSlugs = toAssign.map((c) => c.slug);

    // Mark these agents as used
    for (const did of assignedDids) {
      usedDids.add(did);
    }

    results.push({
      role: role.name,
      assigned: assignedDids,
      assignedSlugs,
      unfilled: neededCount - toAssign.length,
    });
  }

  return results;
}

/**
 * Check if a swarm has all roles filled.
 *
 * @param swarm - The swarm to check
 * @returns True if all roles are fully staffed
 */
export function isSwarmFullyStaffed(swarm: SwarmFrontmatter): boolean {
  for (const role of swarm.roles) {
    if (role.assigned.length < role.count) {
      return false;
    }
  }
  return true;
}

/**
 * Get swarm staffing summary.
 *
 * @param swarm - The swarm to summarize
 * @returns Object with filled, needed, and total counts
 */
export function getSwarmStaffingSummary(swarm: SwarmFrontmatter): {
  filled: number;
  needed: number;
  total: number;
  byRole: Array<{ role: string; filled: number; needed: number }>;
} {
  let filled = 0;
  let total = 0;
  const byRole: Array<{ role: string; filled: number; needed: number }> = [];

  for (const role of swarm.roles) {
    const roleFilled = role.assigned.length;
    filled += roleFilled;
    total += role.count;
    byRole.push({
      role: role.name,
      filled: roleFilled,
      needed: role.count,
    });
  }

  return {
    filled,
    needed: total - filled,
    total,
    byRole,
  };
}
