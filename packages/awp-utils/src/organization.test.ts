import { describe, it, expect } from "vitest";
import {
  buildOrgTree,
  getAncestors,
  getDescendants,
  getOrgDepth,
  detectOrgCycles,
  resolveCapabilities,
  isCapabilityAllowed,
  rollupBudget,
  checkBudget,
  resolveEscalationPath,
  resolveApprover,
  canSpawnChild,
  canRecruitMember,
  validateOrgStructure,
  checkMemberGates,
  getOrgSummary,
} from "./organization.js";
import type {
  OrganizationFrontmatter,
  OrgKind,
  OrgMember,
  ReputationProfileFrontmatter,
  ReputationDimension,
} from "@agent-workspace/core";

// --- fixtures ---------------------------------------------------------------

function org(
  slug: string,
  parent: string | null,
  kind: OrgKind = "team",
  overrides: Partial<OrganizationFrontmatter> = {},
): OrganizationFrontmatter {
  return {
    awp: "0.4.0",
    ogp: "1.0",
    type: "organization",
    id: `org:${slug}`,
    name: slug,
    kind,
    mission: "test unit",
    status: "active",
    created: "2026-05-22T00:00:00Z",
    parent,
    children: [],
    accountableAgent: `did:key:${slug}-agent`,
    humanOwner: "user:marc",
    members: [],
    capabilities: [],
    ...overrides,
  };
}

/** A canonical 3-tier chart: acme (org) -> engineering (division) -> platform (team). */
function threeTier(): OrganizationFrontmatter[] {
  return [
    org("acme", null, "org", { children: ["org:engineering"] }),
    org("engineering", "org:acme", "division", { children: ["org:platform"] }),
    org("platform", "org:engineering", "team"),
  ];
}

// --- buildOrgTree -----------------------------------------------------------

describe("buildOrgTree", () => {
  it("indexes units, identifies the root, and derives children from parent edges", () => {
    const tree = buildOrgTree(threeTier());
    expect(tree.byId.size).toBe(3);
    expect(tree.root).toBe("org:acme");
    expect(tree.childrenOf.get("org:acme")).toEqual(["org:engineering"]);
    expect(tree.childrenOf.get("org:engineering")).toEqual(["org:platform"]);
    expect(tree.childrenOf.get("org:platform")).toEqual([]);
  });

  it("handles a dangling parent reference without throwing", () => {
    const tree = buildOrgTree([org("orphan", "org:ghost")]);
    expect(tree.byId.size).toBe(1);
    expect(tree.root).toBeNull();
  });
});

// --- traversal --------------------------------------------------------------

describe("getAncestors / getDescendants / getOrgDepth", () => {
  it("returns ancestors root-first and descendants breadth-first", () => {
    const tree = buildOrgTree(threeTier());
    expect(getAncestors(tree, "org:platform").map((o) => o.id)).toEqual([
      "org:acme",
      "org:engineering",
    ]);
    expect(getDescendants(tree, "org:acme").map((o) => o.id)).toEqual([
      "org:engineering",
      "org:platform",
    ]);
  });

  it("root has no ancestors and leaf has no descendants", () => {
    const tree = buildOrgTree(threeTier());
    expect(getAncestors(tree, "org:acme")).toEqual([]);
    expect(getDescendants(tree, "org:platform")).toEqual([]);
  });

  it("computes depth from the root", () => {
    const tree = buildOrgTree(threeTier());
    expect(getOrgDepth(tree, "org:acme")).toBe(0);
    expect(getOrgDepth(tree, "org:engineering")).toBe(1);
    expect(getOrgDepth(tree, "org:platform")).toBe(2);
  });
});

// --- detectOrgCycles --------------------------------------------------------

describe("detectOrgCycles", () => {
  it("finds none in a well-formed forest", () => {
    expect(detectOrgCycles(buildOrgTree(threeTier()))).toEqual([]);
  });

  it("detects a parent-chain cycle", () => {
    const tree = buildOrgTree([
      org("a", "org:b"),
      org("b", "org:a"),
    ]);
    const cycles = detectOrgCycles(tree);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain("org:a");
    expect(cycles[0]).toContain("org:b");
  });
});

// --- capability resolution --------------------------------------------------

describe("resolveCapabilities", () => {
  it("inherits ancestor capabilities flagged inherited with a source", () => {
    const orgs = threeTier();
    orgs[0].capabilities = [
      { name: "deploy:production", irreversible: true, requiresApproval: true },
    ];
    const tree = buildOrgTree(orgs);
    const resolved = resolveCapabilities(tree, "org:platform");
    const deploy = resolved.effective.find((c) => c.name === "deploy:production");
    expect(deploy?.inherited).toBe(true);
    expect(resolved.sources.get("deploy:production")).toBe("org:acme");
  });

  it("nearest unit wins on a name collision", () => {
    const orgs = threeTier();
    orgs[0].capabilities = [{ name: "x", irreversible: false, requiresApproval: true }];
    orgs[2].capabilities = [{ name: "x", irreversible: false, requiresApproval: false }];
    const tree = buildOrgTree(orgs);
    const resolved = resolveCapabilities(tree, "org:platform");
    const x = resolved.effective.find((c) => c.name === "x");
    expect(x?.inherited).toBe(false);
    expect(x?.requiresApproval).toBe(false);
    expect(resolved.sources.get("x")).toBe("org:platform");
  });

  it("isCapabilityAllowed reports approval/irreversible flags and source", () => {
    const orgs = threeTier();
    orgs[0].capabilities = [
      { name: "deploy:production", irreversible: true, requiresApproval: true },
    ];
    const tree = buildOrgTree(orgs);
    const allowed = isCapabilityAllowed(tree, "org:platform", "deploy:production");
    expect(allowed).toEqual({
      granted: true,
      requiresApproval: true,
      irreversible: true,
      source: "org:acme",
    });
    const denied = isCapabilityAllowed(tree, "org:platform", "delete:everything");
    expect(denied.granted).toBe(false);
  });
});

// --- budget -----------------------------------------------------------------

describe("rollupBudget / checkBudget", () => {
  function budgeted(): OrganizationFrontmatter[] {
    const orgs = threeTier();
    orgs[0].budget = { allocation: { tokens: 1000 }, consumption: { tokens: 0 } };
    orgs[1].budget = { allocation: {}, consumption: { tokens: 600 } };
    orgs[2].budget = { allocation: {}, consumption: { tokens: 500 } };
    return orgs;
  }

  it("sums subtree consumption and flags over-budget lines", () => {
    const tree = buildOrgTree(budgeted());
    const rollup = rollupBudget(tree, "org:acme");
    expect(rollup.subtreeConsumption.tokens).toBe(1100);
    expect(rollup.overBudget).toBe(true);
    expect(rollup.exceededLines).toEqual(["tokens"]);
  });

  it("a unit with no allocation is never over budget", () => {
    const tree = buildOrgTree(budgeted());
    const rollup = rollupBudget(tree, "org:engineering");
    expect(rollup.subtreeConsumption.tokens).toBe(1100);
    expect(rollup.overBudget).toBe(false);
  });

  it("checkBudget computes remaining and flags a breaching request", () => {
    const tree = buildOrgTree(budgeted());
    const check = checkBudget(tree, "org:acme", { tokens: 50 });
    expect(check.withinBudget).toBe(false);
    expect(check.exceededLines).toEqual(["tokens"]);
    expect(check.remaining.tokens).toBe(-100);
  });
});

// --- escalation -------------------------------------------------------------

describe("resolveEscalationPath / resolveApprover", () => {
  it("chains from the unit up to the root", () => {
    const tree = buildOrgTree(threeTier());
    const path = resolveEscalationPath(tree, "org:platform");
    expect(path.map((s) => s.orgId)).toEqual([
      "org:platform",
      "org:engineering",
      "org:acme",
    ]);
  });

  it("short-circuits at a unit that sets escalateTo", () => {
    const orgs = threeTier();
    orgs[1].escalation = { escalateTo: "user:vp" };
    const tree = buildOrgTree(orgs);
    const path = resolveEscalationPath(tree, "org:platform");
    expect(path.map((s) => s.orgId)).toEqual(["org:platform", "org:engineering"]);
    expect(path[1].escalateTo).toBe("user:vp");
  });

  it("resolveApprover prefers escalateTo, else the unit's humanOwner", () => {
    const tree = buildOrgTree(threeTier());
    expect(resolveApprover(tree, "org:platform")).toBe("user:marc");

    const orgs = threeTier();
    orgs[2].escalation = { escalateTo: "user:director" };
    expect(resolveApprover(buildOrgTree(orgs), "org:platform")).toBe("user:director");
  });
});

// --- spawn authority --------------------------------------------------------

describe("canSpawnChild / canRecruitMember", () => {
  it("permits a spawn that satisfies authority, tier, and caps", () => {
    const orgs = threeTier();
    orgs[0].spawnAuthority = { canSpawnKinds: ["division"], maxChildren: 5 };
    const tree = buildOrgTree(orgs);
    expect(canSpawnChild(tree, "org:acme", "division").allowed).toBe(true);
  });

  it("rejects a kind not in canSpawnKinds", () => {
    const orgs = threeTier();
    orgs[0].spawnAuthority = { canSpawnKinds: ["division"] };
    const check = canSpawnChild(buildOrgTree(orgs), "org:acme", "team");
    expect(check.allowed).toBe(false);
    expect(check.reasons.join(" ")).toContain("team");
  });

  it("rejects a team trying to spawn a division (wrong tier)", () => {
    const orgs = threeTier();
    orgs[2].spawnAuthority = { canSpawnKinds: ["org", "division", "team"] };
    const check = canSpawnChild(buildOrgTree(orgs), "org:platform", "division");
    expect(check.allowed).toBe(false);
    expect(check.reasons.join(" ")).toContain("lower tier");
  });

  it("rejects a spawn at the maxChildren limit", () => {
    const orgs = threeTier();
    orgs[0].spawnAuthority = { canSpawnKinds: ["division"], maxChildren: 1 };
    // acme already has one child (engineering)
    const check = canSpawnChild(buildOrgTree(orgs), "org:acme", "division");
    expect(check.allowed).toBe(false);
    expect(check.reasons.join(" ")).toContain("maxChildren");
  });

  it("rejects a spawn past maxDepth", () => {
    const orgs = threeTier();
    orgs[1].spawnAuthority = { canSpawnKinds: ["team"], maxDepth: 1 };
    // engineering is at depth 1; a child would be at depth 2 > maxDepth 1
    const check = canSpawnChild(buildOrgTree(orgs), "org:engineering", "team");
    expect(check.allowed).toBe(false);
    expect(check.reasons.join(" ")).toContain("maxDepth");
  });

  it("rejects a spawn when the parent has no spawnAuthority", () => {
    const check = canSpawnChild(buildOrgTree(threeTier()), "org:acme", "division");
    expect(check.allowed).toBe(false);
    expect(check.reasons.join(" ")).toContain("no spawnAuthority");
  });

  it("canRecruitMember falls back to the parent's authority", () => {
    const orgs = threeTier();
    orgs[1].spawnAuthority = { canSpawnKinds: ["team"], canRecruit: true };
    const tree = buildOrgTree(orgs);
    // platform has no authority of its own; engineering (parent) grants recruit
    expect(canRecruitMember(tree, "org:platform").allowed).toBe(true);
    expect(canRecruitMember(tree, "org:acme").allowed).toBe(false);
  });
});

// --- structural validation --------------------------------------------------

describe("validateOrgStructure", () => {
  it("passes a well-formed chart", () => {
    const orgs = threeTier();
    orgs[1].children = ["org:platform"];
    orgs[0].children = ["org:engineering"];
    expect(validateOrgStructure(orgs).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("flags zero roots and multiple roots", () => {
    const noRoot = validateOrgStructure([org("a", "org:b"), org("b", "org:a")]);
    expect(noRoot.some((i) => i.message.includes("No root"))).toBe(true);

    const twoRoots = validateOrgStructure([org("a", null), org("b", null)]);
    expect(twoRoots.filter((i) => i.message.includes("Multiple root")).length).toBe(2);
  });

  it("flags a dangling parent reference", () => {
    const issues = validateOrgStructure([org("a", null), org("b", "org:ghost")]);
    expect(issues.some((i) => i.orgId === "org:b" && i.severity === "error")).toBe(true);
  });

  it("flags an irreversible capability without requiresApproval", () => {
    const orgs = [
      org("a", null, "org", {
        capabilities: [{ name: "deploy", irreversible: true, requiresApproval: false }],
      }),
    ];
    const issues = validateOrgStructure(orgs);
    expect(
      issues.some((i) => i.severity === "error" && i.message.includes("irreversible")),
    ).toBe(true);
  });

  it("warns on parent/children denormalization drift", () => {
    const orgs = threeTier();
    orgs[0].children = []; // acme drops engineering from children[]
    const issues = validateOrgStructure(orgs);
    expect(
      issues.some((i) => i.severity === "warning" && i.message.includes("drift")),
    ).toBe(true);
  });

  it("detects a cycle as an error", () => {
    const issues = validateOrgStructure([org("a", "org:b"), org("b", "org:a")]);
    expect(issues.some((i) => i.message.includes("Cycle"))).toBe(true);
  });

  it("attaches actionable remediation to every issue", () => {
    const orgs = [
      org("a", null, "org", {
        capabilities: [{ name: "deploy", irreversible: true, requiresApproval: false }],
      }),
      org("b", null), // second root
    ];
    const issues = validateOrgStructure(orgs);
    expect(issues.length).toBeGreaterThan(0);
    // Each issue carries a fix, and command-style fixes reference bare slugs
    // (no "org:" prefix) so they can be pasted straight into `awp org ...`.
    for (const issue of issues) {
      expect(issue.remediation && issue.remediation.length).toBeTruthy();
    }
    const capIssue = issues.find((i) => i.message.includes("irreversible"));
    expect(capIssue?.remediation).toContain("awp org capability grant a deploy");
    expect(capIssue?.remediation).not.toContain("org:a");
  });
});

// --- reputation gates -------------------------------------------------------

describe("checkMemberGates", () => {
  const NOW = new Date("2026-05-22T00:00:00Z");
  const dim = (score: number): ReputationDimension => ({
    score,
    confidence: 0.5,
    sampleSize: 10,
    lastSignal: NOW.toISOString(),
  });
  const profile = (
    dimensions: Record<string, ReputationDimension>,
  ): ReputationProfileFrontmatter => ({
    awp: "0.4.0",
    rdp: "1.0",
    type: "reputation-profile",
    id: "reputation:alice",
    agentDid: "did:key:alice",
    agentName: "Alice",
    lastUpdated: NOW.toISOString(),
    dimensions,
    signals: [],
  });

  const member: OrgMember = {
    did: "did:key:alice",
    role: "ic",
    slug: "alice",
    minReputation: { reliability: 0.7 },
  };

  it("returns no warnings when the gate is met", () => {
    expect(checkMemberGates(member, profile({ reliability: dim(0.9) }), NOW)).toEqual([]);
  });

  it("warns when the decayed score is below the threshold", () => {
    const warnings = checkMemberGates(member, profile({ reliability: dim(0.4) }), NOW);
    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("reliability");
  });

  it("warns when there is no reputation data", () => {
    const warnings = checkMemberGates(member, undefined, NOW);
    expect(warnings[0]).toContain("no reputation data");
  });
});

// --- summary ----------------------------------------------------------------

describe("getOrgSummary", () => {
  it("aggregates member, child, descendant counts, budget, and KPI status", () => {
    const orgs = threeTier();
    orgs[0].members = [{ did: "did:key:ceo", role: "lead", slug: "ceo" }];
    orgs[0].budget = { allocation: { tokens: 100 }, consumption: { tokens: 10 } };
    orgs[0].kpis = [
      { name: "ship-rate", target: 5, current: 6, direction: "higher-is-better" },
      { name: "defects", target: 2, current: 4, direction: "lower-is-better" },
    ];
    const summary = getOrgSummary(buildOrgTree(orgs), "org:acme");
    expect(summary.memberCount).toBe(1);
    expect(summary.directChildren).toBe(1);
    expect(summary.totalDescendants).toBe(2);
    expect(summary.kpiStatus.find((k) => k.name === "ship-rate")?.onTrack).toBe(true);
    expect(summary.kpiStatus.find((k) => k.name === "defects")?.onTrack).toBe(false);
  });
});
