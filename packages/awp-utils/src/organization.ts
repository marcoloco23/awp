/**
 * Organization Protocol (OGP) pure logic.
 *
 * Tree traversal, capability inheritance, budget rollup, escalation-path
 * resolution, and spawn-authority checks for recursive machine org charts.
 *
 * All functions are pure — they operate on already-loaded
 * `OrganizationFrontmatter[]`. Callers (CLI / MCP) load the files first.
 */

import type {
  OrganizationFrontmatter,
  OrgKind,
  OrgCapability,
  OrgBudgetLine,
  OrgMember,
  ReputationProfileFrontmatter,
} from "@agent-workspace/core";
import { computeDecayedScore } from "./reputation.js";

/** Ranking of org tiers — higher number = higher in the chart. */
const KIND_RANK: Record<OrgKind, number> = { org: 3, division: 2, team: 1 };

/** Budget dimensions tracked by rollup/check operations. */
const BUDGET_KEYS = ["tokens", "toolCalls", "spend"] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** An indexed organization tree built from a flat list of units. */
export interface OrgTree {
  /** org ID -> organization */
  byId: Map<string, OrganizationFrontmatter>;
  /** org ID of the unit with parent === null (first one wins if many) */
  root: string | null;
  /** org ID -> child org IDs, derived from authoritative `parent` edges */
  childrenOf: Map<string, string[]>;
}

/** Result of rolling a unit's budget up over its subtree. */
export interface BudgetRollup {
  orgId: string;
  /** This unit's own allocation */
  allocation: OrgBudgetLine;
  /** This unit's own consumption */
  ownConsumption: OrgBudgetLine;
  /** This unit + every descendant's consumption */
  subtreeConsumption: OrgBudgetLine;
  /** True if subtreeConsumption exceeds allocation on any line */
  overBudget: boolean;
  /** Which budget lines are exceeded, e.g. ["tokens", "spend"] */
  exceededLines: string[];
}

/** Result of resolving a unit's effective (own + inherited) capabilities. */
export interface CapabilityResolution {
  /** Own + inherited capabilities, deduped by name (nearest unit wins) */
  effective: OrgCapability[];
  /** capability name -> org ID that granted it */
  sources: Map<string, string>;
}

/** A step on an escalation path. */
export interface EscalationStep {
  orgId: string;
  accountableAgent: string;
  humanOwner: string;
  /** Explicit override target, if this unit sets one */
  escalateTo?: string;
}

/** Result of a spawn-authority pre-flight check. */
export interface SpawnCheck {
  allowed: boolean;
  /** Why the action is disallowed (empty when allowed) */
  reasons: string[];
}

/** A structural validation finding. */
export interface OrgValidationIssue {
  orgId: string;
  severity: "error" | "warning";
  message: string;
}

/** A condensed summary of an organization unit. */
export interface OrgSummary {
  memberCount: number;
  directChildren: number;
  totalDescendants: number;
  budget: BudgetRollup;
  kpiStatus: Array<{ name: string; current: number; target: number; onTrack: boolean }>;
}

// ---------------------------------------------------------------------------
// Budget-line helpers
// ---------------------------------------------------------------------------

function addBudgetLines(a: OrgBudgetLine, b: OrgBudgetLine): OrgBudgetLine {
  return {
    tokens: (a.tokens ?? 0) + (b.tokens ?? 0),
    toolCalls: (a.toolCalls ?? 0) + (b.toolCalls ?? 0),
    spend: (a.spend ?? 0) + (b.spend ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Tree construction
// ---------------------------------------------------------------------------

/**
 * Build an indexed org tree from a flat list of organization units.
 * Parent edges are authoritative; the denormalized `children` field is not used.
 */
export function buildOrgTree(orgs: OrganizationFrontmatter[]): OrgTree {
  const byId = new Map<string, OrganizationFrontmatter>();
  const childrenOf = new Map<string, string[]>();

  for (const org of orgs) {
    byId.set(org.id, org);
    if (!childrenOf.has(org.id)) childrenOf.set(org.id, []);
  }

  let root: string | null = null;
  for (const org of orgs) {
    if (org.parent === null || org.parent === undefined) {
      if (root === null) root = org.id;
    } else {
      const siblings = childrenOf.get(org.parent);
      if (siblings) siblings.push(org.id);
      else childrenOf.set(org.parent, [org.id]);
    }
  }

  return { byId, root, childrenOf };
}

// ---------------------------------------------------------------------------
// Traversal
// ---------------------------------------------------------------------------

/**
 * Get a unit's ancestors, root-first. Empty for the root or an unknown unit.
 */
export function getAncestors(tree: OrgTree, orgId: string): OrganizationFrontmatter[] {
  const chain: OrganizationFrontmatter[] = [];
  const seen = new Set<string>([orgId]);
  let current = tree.byId.get(orgId);

  while (current && current.parent) {
    const parent = tree.byId.get(current.parent);
    if (!parent || seen.has(parent.id)) break;
    chain.push(parent);
    seen.add(parent.id);
    current = parent;
  }

  return chain.reverse();
}

/**
 * Get every descendant of a unit (breadth-first). Excludes the unit itself.
 */
export function getDescendants(tree: OrgTree, orgId: string): OrganizationFrontmatter[] {
  const out: OrganizationFrontmatter[] = [];
  const queue = [...(tree.childrenOf.get(orgId) ?? [])];
  const seen = new Set<string>([orgId]);

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const node = tree.byId.get(id);
    if (node) out.push(node);
    for (const childId of tree.childrenOf.get(id) ?? []) {
      if (!seen.has(childId)) queue.push(childId);
    }
  }

  return out;
}

/** Get a unit's depth from the root (root = 0). */
export function getOrgDepth(tree: OrgTree, orgId: string): number {
  return getAncestors(tree, orgId).length;
}

/**
 * Detect cycles in the parent chains. A well-formed org tree is a forest and
 * has none. Each cycle is returned as a list of org IDs.
 */
export function detectOrgCycles(tree: OrgTree): string[][] {
  const cycles: string[][] = [];
  const seenCycleKeys = new Set<string>();

  for (const startId of tree.byId.keys()) {
    const path: string[] = [];
    const onPath = new Set<string>();
    let current: string | undefined = startId;

    while (current !== undefined) {
      if (onPath.has(current)) {
        const cycle = path.slice(path.indexOf(current));
        const key = [...cycle].sort().join("|");
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push([...cycle, current]);
        }
        break;
      }
      path.push(current);
      onPath.add(current);
      const node = tree.byId.get(current);
      if (!node || node.parent === null || node.parent === undefined) break;
      current = node.parent;
    }
  }

  return cycles;
}

// ---------------------------------------------------------------------------
// Capability resolution (inherited DOWN the tree)
// ---------------------------------------------------------------------------

/**
 * Resolve a unit's effective capabilities: its own grants plus every ancestor's
 * grants. On a name collision the nearest unit (self, then closest ancestor)
 * wins. Inherited entries are flagged `inherited: true`.
 */
export function resolveCapabilities(tree: OrgTree, orgId: string): CapabilityResolution {
  const effective = new Map<string, OrgCapability>();
  const sources = new Map<string, string>();

  const self = tree.byId.get(orgId);
  if (self) {
    for (const cap of self.capabilities ?? []) {
      if (!effective.has(cap.name)) {
        effective.set(cap.name, { ...cap, inherited: false });
        sources.set(cap.name, orgId);
      }
    }
  }

  // Ancestors, nearest first.
  const ancestors = getAncestors(tree, orgId).reverse();
  for (const ancestor of ancestors) {
    for (const cap of ancestor.capabilities ?? []) {
      if (!effective.has(cap.name)) {
        effective.set(cap.name, { ...cap, inherited: true });
        sources.set(cap.name, ancestor.id);
      }
    }
  }

  return { effective: [...effective.values()], sources };
}

/**
 * Check whether a unit may perform a named capability, accounting for
 * inheritance. `granted` is false when the capability is not in scope.
 */
export function isCapabilityAllowed(
  tree: OrgTree,
  orgId: string,
  capabilityName: string,
): { granted: boolean; requiresApproval: boolean; irreversible: boolean; source: string | null } {
  const { effective, sources } = resolveCapabilities(tree, orgId);
  const cap = effective.find((c) => c.name === capabilityName);
  if (!cap) {
    return { granted: false, requiresApproval: false, irreversible: false, source: null };
  }
  return {
    granted: true,
    requiresApproval: cap.requiresApproval,
    irreversible: cap.irreversible,
    source: sources.get(capabilityName) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Budget rollup (summed UP the tree)
// ---------------------------------------------------------------------------

/**
 * Roll a unit's budget up over its subtree: subtree consumption is this unit's
 * own consumption plus every descendant's own consumption, compared against
 * this unit's allocation.
 */
export function rollupBudget(tree: OrgTree, orgId: string): BudgetRollup {
  const self = tree.byId.get(orgId);
  const allocation: OrgBudgetLine = self?.budget?.allocation ?? {};
  const ownConsumption: OrgBudgetLine = self?.budget?.consumption ?? {};

  let subtreeConsumption: OrgBudgetLine = { ...ownConsumption };
  for (const descendant of getDescendants(tree, orgId)) {
    subtreeConsumption = addBudgetLines(subtreeConsumption, descendant.budget?.consumption ?? {});
  }

  const exceededLines: string[] = [];
  for (const key of BUDGET_KEYS) {
    const limit = allocation[key];
    if (limit !== undefined && (subtreeConsumption[key] ?? 0) > limit) {
      exceededLines.push(key);
    }
  }

  return {
    orgId,
    allocation,
    ownConsumption,
    subtreeConsumption,
    overBudget: exceededLines.length > 0,
    exceededLines,
  };
}

/**
 * Advisory check: would consuming `requested` keep the subtree within the
 * unit's allocation? Lines with no allocation are treated as unlimited.
 */
export function checkBudget(
  tree: OrgTree,
  orgId: string,
  requested: OrgBudgetLine,
): { withinBudget: boolean; remaining: OrgBudgetLine; exceededLines: string[] } {
  const rollup = rollupBudget(tree, orgId);
  const remaining: OrgBudgetLine = {};
  const exceededLines: string[] = [];

  for (const key of BUDGET_KEYS) {
    const limit = rollup.allocation[key];
    if (limit === undefined) continue;
    const used = rollup.subtreeConsumption[key] ?? 0;
    const want = requested[key] ?? 0;
    remaining[key] = limit - used;
    if (used + want > limit) exceededLines.push(key);
  }

  return { withinBudget: exceededLines.length === 0, remaining, exceededLines };
}

// ---------------------------------------------------------------------------
// Escalation-path resolution (walk UP to the human owner)
// ---------------------------------------------------------------------------

/**
 * Resolve the escalation path for a unit: an ordered chain from the unit itself
 * up toward the root. A unit that sets `escalation.escalateTo` short-circuits
 * the chain at that step.
 */
export function resolveEscalationPath(tree: OrgTree, orgId: string): EscalationStep[] {
  const self = tree.byId.get(orgId);
  if (!self) return [];

  const chain: OrganizationFrontmatter[] = [self, ...getAncestors(tree, orgId).reverse()];
  const steps: EscalationStep[] = [];

  for (const node of chain) {
    const step: EscalationStep = {
      orgId: node.id,
      accountableAgent: node.accountableAgent,
      humanOwner: node.humanOwner,
    };
    if (node.escalation?.escalateTo) step.escalateTo = node.escalation.escalateTo;
    steps.push(step);
    if (node.escalation?.escalateTo) break;
  }

  return steps;
}

/**
 * Resolve who must approve an exception for a unit: the unit's own
 * `escalation.escalateTo` if set, otherwise its `humanOwner`.
 */
export function resolveApprover(tree: OrgTree, orgId: string): string {
  const self = tree.byId.get(orgId);
  if (!self) return "";
  return self.escalation?.escalateTo ?? self.humanOwner;
}

// ---------------------------------------------------------------------------
// Spawn-authority checks
// ---------------------------------------------------------------------------

/**
 * Check whether a unit may spawn a child of the given kind. Verifies spawn
 * authority, kind tier ordering, child cap, and depth cap.
 */
export function canSpawnChild(
  tree: OrgTree,
  parentOrgId: string,
  childKind: OrgKind,
): SpawnCheck {
  const parent = tree.byId.get(parentOrgId);
  if (!parent) {
    return { allowed: false, reasons: [`Parent org "${parentOrgId}" not found`] };
  }

  const reasons: string[] = [];
  const auth = parent.spawnAuthority;

  if (!auth) {
    return {
      allowed: false,
      reasons: [`Org "${parentOrgId}" has no spawnAuthority — it cannot create sub-units`],
    };
  }

  if (!auth.canSpawnKinds.includes(childKind)) {
    reasons.push(
      `Org "${parentOrgId}" may not spawn kind "${childKind}" ` +
        `(allowed: ${auth.canSpawnKinds.join(", ") || "none"})`,
    );
  }

  if (KIND_RANK[childKind] >= KIND_RANK[parent.kind]) {
    reasons.push(
      `A "${parent.kind}" cannot spawn a "${childKind}" — sub-units must be a lower tier`,
    );
  }

  if (auth.maxChildren !== undefined && auth.maxChildren > 0) {
    const childCount = tree.childrenOf.get(parentOrgId)?.length ?? 0;
    if (childCount >= auth.maxChildren) {
      reasons.push(`Org "${parentOrgId}" is at its maxChildren limit (${auth.maxChildren})`);
    }
  }

  if (auth.maxDepth !== undefined) {
    const childDepth = getOrgDepth(tree, parentOrgId) + 1;
    if (childDepth > auth.maxDepth) {
      reasons.push(
        `Spawning under "${parentOrgId}" would place a unit at depth ${childDepth}, ` +
          `past the maxDepth of ${auth.maxDepth}`,
      );
    }
  }

  return { allowed: reasons.length === 0, reasons };
}

/**
 * Check whether a unit may recruit member agents. Falls back to the parent's
 * authority when the unit itself does not grant `canRecruit`.
 */
export function canRecruitMember(tree: OrgTree, orgId: string): SpawnCheck {
  const org = tree.byId.get(orgId);
  if (!org) {
    return { allowed: false, reasons: [`Org "${orgId}" not found`] };
  }

  if (org.spawnAuthority?.canRecruit) return { allowed: true, reasons: [] };

  if (org.parent) {
    const parent = tree.byId.get(org.parent);
    if (parent?.spawnAuthority?.canRecruit) return { allowed: true, reasons: [] };
  }

  return {
    allowed: false,
    reasons: [`Org "${orgId}" lacks recruit authority and no parent grants it`],
  };
}

// ---------------------------------------------------------------------------
// Structural validation
// ---------------------------------------------------------------------------

/**
 * Validate the structural integrity of an org chart, beyond what JSON Schema
 * can express: single root, resolvable references, parent/children
 * consistency, no cycles, the irreversible-capability invariant, and tier
 * monotonicity. Returns errors and advisory warnings.
 */
export function validateOrgStructure(orgs: OrganizationFrontmatter[]): OrgValidationIssue[] {
  const issues: OrgValidationIssue[] = [];
  const tree = buildOrgTree(orgs);

  if (orgs.length === 0) return issues;

  const roots = orgs.filter((o) => o.parent === null || o.parent === undefined);
  if (roots.length === 0) {
    issues.push({
      orgId: "",
      severity: "error",
      message: "No root organization — every unit has a parent, so the chart has no top",
    });
  } else if (roots.length > 1) {
    for (const root of roots) {
      issues.push({
        orgId: root.id,
        severity: "error",
        message: `Multiple root organizations — "${root.id}" has no parent (expected exactly one root)`,
      });
    }
  }

  for (const org of orgs) {
    if (org.parent && !tree.byId.has(org.parent)) {
      issues.push({
        orgId: org.id,
        severity: "error",
        message: `Parent "${org.parent}" does not resolve to an existing organization`,
      });
    }

    for (const childId of org.children ?? []) {
      if (!tree.byId.has(childId)) {
        issues.push({
          orgId: org.id,
          severity: "error",
          message: `Child "${childId}" does not resolve to an existing organization`,
        });
      }
    }

    // Parent/children denormalization drift.
    const actualChildren = new Set(tree.childrenOf.get(org.id) ?? []);
    const declaredChildren = new Set(org.children ?? []);
    for (const childId of actualChildren) {
      if (!declaredChildren.has(childId)) {
        issues.push({
          orgId: org.id,
          severity: "warning",
          message: `"${childId}" declares "${org.id}" as parent but is missing from children[] (denormalized drift)`,
        });
      }
    }
    for (const childId of declaredChildren) {
      if (!actualChildren.has(childId)) {
        issues.push({
          orgId: org.id,
          severity: "warning",
          message: `children[] lists "${childId}" but it does not declare "${org.id}" as parent (denormalized drift)`,
        });
      }
    }

    // Irreversible-capability invariant.
    for (const cap of org.capabilities ?? []) {
      if (cap.irreversible && !cap.requiresApproval) {
        issues.push({
          orgId: org.id,
          severity: "error",
          message: `Capability "${cap.name}" is irreversible but requiresApproval is false`,
        });
      }
    }

    // Tier monotonicity.
    if (org.parent) {
      const parent = tree.byId.get(org.parent);
      if (parent && KIND_RANK[org.kind] >= KIND_RANK[parent.kind]) {
        issues.push({
          orgId: org.id,
          severity: "warning",
          message: `Kind "${org.kind}" is not below parent kind "${parent.kind}" — tiers should descend org > division > team`,
        });
      }
    }

    // Accountability seat.
    if (
      (org.members?.length ?? 0) > 0 &&
      !org.members.some((m) => m.did === org.accountableAgent)
    ) {
      issues.push({
        orgId: org.id,
        severity: "warning",
        message: `accountableAgent "${org.accountableAgent}" is not among this unit's members`,
      });
    }
  }

  for (const cycle of detectOrgCycles(tree)) {
    issues.push({
      orgId: cycle[0],
      severity: "error",
      message: `Cycle in organization hierarchy: ${cycle.join(" -> ")}`,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Reputation gates & summaries
// ---------------------------------------------------------------------------

/**
 * Evaluate a member's advisory reputation gates against a reputation profile.
 * Returns a list of human-readable warnings (empty when the member qualifies).
 * Reuses RDP time-decay via computeDecayedScore.
 */
export function checkMemberGates(
  member: OrgMember,
  profile: ReputationProfileFrontmatter | undefined,
  now: Date = new Date(),
): string[] {
  const warnings: string[] = [];
  if (!member.minReputation) return warnings;

  for (const [gate, minScore] of Object.entries(member.minReputation)) {
    const dim = gate.startsWith("domain-competence:")
      ? profile?.domainCompetence?.[gate.slice("domain-competence:".length)]
      : profile?.dimensions?.[gate];

    if (!dim) {
      warnings.push(`${member.slug}: no reputation data for "${gate}" (requires >= ${minScore})`);
      continue;
    }

    const score = computeDecayedScore(dim, now);
    if (score < minScore) {
      warnings.push(`${member.slug}: ${gate} ${score.toFixed(2)} < required ${minScore}`);
    }
  }

  return warnings;
}

/**
 * Produce a condensed summary of an organization unit — member/child counts,
 * budget rollup, and KPI status.
 */
export function getOrgSummary(tree: OrgTree, orgId: string): OrgSummary {
  const org = tree.byId.get(orgId);
  const budget = rollupBudget(tree, orgId);
  const kpiStatus = (org?.kpis ?? []).map((kpi) => {
    const current = kpi.current ?? 0;
    const onTrack =
      kpi.direction === "lower-is-better" ? current <= kpi.target : current >= kpi.target;
    return { name: kpi.name, current, target: kpi.target, onTrack };
  });

  return {
    memberCount: org?.members?.length ?? 0,
    directChildren: tree.childrenOf.get(orgId)?.length ?? 0,
    totalDescendants: getDescendants(tree, orgId).length,
    budget,
    kpiStatus,
  };
}
