import { writeFile, access } from "node:fs/promises";
import { AWP_VERSION, OGP_VERSION } from "@agent-workspace/core";
import type {
  OrganizationFrontmatter,
  OrgKind,
  OrgMember,
  OrgCapability,
  OrgSpawnAuthority,
  OrgEscalation,
  OrgKPI,
} from "@agent-workspace/core";
import {
  buildOrgTree,
  resolveCapabilities,
  rollupBudget,
  resolveEscalationPath,
  resolveApprover,
  canSpawnChild,
  validateOrgStructure,
  getOrgSummary,
  getDescendants,
  checkMemberGates,
} from "@agent-workspace/utils";
import { requireWorkspaceRoot } from "../lib/cli-utils.js";
import { serializeWorkspaceFile } from "../lib/frontmatter.js";
import { getAgentDid } from "../lib/artifact.js";
import { loadProfile } from "../lib/reputation.js";
import {
  validateSlug,
  slugToOrgPath,
  orgIdToSlug,
  loadOrganization,
  listOrganizations,
  ensureOrganizationsDir,
} from "../lib/organization.js";

const VALID_KINDS: OrgKind[] = ["org", "division", "team"];
const VALID_STATUSES = ["forming", "active", "paused", "dissolved"];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function titleize(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Parse a tri-state boolean flag value (returns undefined when not provided). */
function parseBoolFlag(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const s = value.trim().toLowerCase();
  if (["true", "yes", "1", "on"].includes(s)) return true;
  if (["false", "no", "0", "off"].includes(s)) return false;
  console.error(`Invalid boolean value: "${value}". Use true or false.`);
  process.exit(1);
}

/** Parse a non-negative number flag, exiting on a bad value. */
function parseNonNegative(value: string, label: string): number {
  const n = Number(value);
  if (isNaN(n) || n < 0) {
    console.error(`Invalid ${label}: must be a non-negative number.`);
    process.exit(1);
  }
  return n;
}

/** Parse "dimension:score" / "domain-competence:domain:score" specs. */
function parseMinReputation(specs: string[] | undefined): Record<string, number> {
  const minReputation: Record<string, number> = {};
  if (!specs) return minReputation;

  for (const spec of specs) {
    const parts = spec.split(":");
    if (parts.length === 2) {
      const [dim, scoreStr] = parts;
      const score = parseFloat(scoreStr);
      if (isNaN(score) || score < 0 || score > 1) {
        console.error(`Invalid score for ${dim}: must be 0.0-1.0`);
        process.exit(1);
      }
      minReputation[dim] = score;
    } else if (parts.length === 3 && parts[0] === "domain-competence") {
      const [, domain, scoreStr] = parts;
      const score = parseFloat(scoreStr);
      if (isNaN(score) || score < 0 || score > 1) {
        console.error(`Invalid score for domain ${domain}: must be 0.0-1.0`);
        process.exit(1);
      }
      minReputation[`domain-competence:${domain}`] = score;
    } else {
      console.error(
        `Invalid reputation format: ${spec}. Use "dimension:score" or "domain-competence:domain:score"`,
      );
      process.exit(1);
    }
  }

  return minReputation;
}

/**
 * awp org create <slug>
 */
export async function orgCreateCommand(
  slug: string,
  options: {
    name?: string;
    kind?: string;
    mission?: string;
    parent?: string;
    accountable?: string;
    humanOwner?: string;
  },
): Promise<void> {
  const root = await requireWorkspaceRoot();

  if (!validateSlug(slug)) {
    console.error(`Invalid org slug: ${slug} (must be lowercase alphanumeric + hyphens)`);
    process.exit(1);
  }

  const kind = (options.kind ?? "team") as OrgKind;
  if (!VALID_KINDS.includes(kind)) {
    console.error(`Invalid kind: ${options.kind}. Use: ${VALID_KINDS.join(", ")}`);
    process.exit(1);
  }

  await ensureOrganizationsDir(root);

  const filePath = slugToOrgPath(root, slug);
  if (await fileExists(filePath)) {
    console.error(`Organization "${slug}" already exists.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const name = options.name ?? titleize(slug);
  const accountableAgent = options.accountable ?? (await getAgentDid(root));
  const humanOwner = options.humanOwner ?? "user:owner";
  const parentId = options.parent ? `org:${options.parent}` : null;

  // Advisory spawn-authority check against the parent.
  if (parentId) {
    const orgs = (await listOrganizations(root)).map((o) => o.frontmatter);
    const tree = buildOrgTree(orgs);
    if (!tree.byId.has(parentId)) {
      console.error(`Parent organization "${parentId}" not found.`);
      process.exit(1);
    }
    const check = canSpawnChild(tree, parentId, kind);
    if (!check.allowed) {
      console.log(`Warning: spawn-authority check failed for parent "${parentId}":`);
      for (const reason of check.reasons) console.log(`  - ${reason}`);
      console.log("Proceeding anyway — humans decide (OGP gates are advisory).");
    }
  }

  const fm: OrganizationFrontmatter = {
    awp: AWP_VERSION,
    ogp: OGP_VERSION,
    type: "organization",
    id: `org:${slug}`,
    name,
    kind,
    mission: options.mission ?? "Define the mission for this organization unit",
    status: "forming",
    created: now,
    parent: parentId,
    children: [],
    accountableAgent,
    humanOwner,
    members: [],
    capabilities: [],
  };

  const body =
    `# ${name}\n\n${fm.mission}\n\n` +
    `- **Kind:** ${kind}\n` +
    `- **Accountable agent:** ${accountableAgent}\n` +
    `- **Human owner:** ${humanOwner}\n`;

  await writeFile(filePath, serializeWorkspaceFile({ frontmatter: fm, body, filePath }), "utf-8");

  // Keep the parent's denormalized children[] in sync.
  if (parentId) {
    try {
      const parent = await loadOrganization(root, orgIdToSlug(parentId));
      if (!parent.frontmatter.children.includes(fm.id)) {
        parent.frontmatter.children.push(fm.id);
        await writeFile(parent.filePath, serializeWorkspaceFile(parent), "utf-8");
      }
    } catch {
      console.log(`Note: could not update parent "${parentId}" children[].`);
    }
  }

  console.log(`Created organizations/${slug}.md (kind: ${kind}, status: forming)`);
}

/**
 * awp org show <slug>
 */
export async function orgShowCommand(slug: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const fm = org.frontmatter;
  const orgs = (await listOrganizations(root)).map((o) => o.frontmatter);
  const tree = buildOrgTree(orgs);
  const summary = getOrgSummary(tree, fm.id);

  console.log(`Organization: ${fm.name}`);
  console.log(`ID:        ${fm.id}`);
  console.log(`Kind:      ${fm.kind}`);
  console.log(`Status:    ${fm.status}`);
  console.log(`Mission:   ${fm.mission}`);
  console.log(`Parent:    ${fm.parent ?? "(root)"}`);
  console.log(`Children:  ${fm.children.length > 0 ? fm.children.join(", ") : "(none)"}`);
  console.log(`Accountable: ${fm.accountableAgent}`);
  console.log(`Human owner: ${fm.humanOwner}`);

  console.log("");
  console.log(`Members (${summary.memberCount})`);
  console.log("-".repeat(20));
  for (const m of fm.members) {
    const seat = m.seat ? ` [${m.seat}]` : "";
    const gates = m.minReputation
      ? ` (requires: ${Object.entries(m.minReputation)
          .map(([k, v]) => `${k}>=${v}`)
          .join(", ")})`
      : "";
    console.log(`  ${m.slug} — ${m.role}${seat}${gates}`);
  }

  const resolved = resolveCapabilities(tree, fm.id);
  console.log("");
  console.log(`Capabilities (${resolved.effective.length} effective)`);
  console.log("-".repeat(20));
  for (const cap of resolved.effective) {
    const flags: string[] = [];
    if (cap.irreversible) flags.push("irreversible");
    if (cap.requiresApproval) flags.push("requires-approval");
    if (cap.inherited) flags.push(`inherited from ${resolved.sources.get(cap.name)}`);
    console.log(`  ${cap.name}${flags.length > 0 ? ` — ${flags.join(", ")}` : ""}`);
  }

  if (fm.budget) {
    const rollup = rollupBudget(tree, fm.id);
    console.log("");
    console.log("Budget");
    console.log("-".repeat(20));
    console.log(`  Allocation:  ${JSON.stringify(rollup.allocation)}`);
    console.log(`  Subtree use: ${JSON.stringify(rollup.subtreeConsumption)}`);
    if (rollup.overBudget) {
      console.log(`  OVER BUDGET on: ${rollup.exceededLines.join(", ")}`);
    }
  }

  if (summary.kpiStatus.length > 0) {
    console.log("");
    console.log("KPIs");
    console.log("-".repeat(20));
    for (const kpi of summary.kpiStatus) {
      const icon = kpi.onTrack ? "[on track]" : "[off track]";
      console.log(`  ${kpi.name}: ${kpi.current}/${kpi.target} ${icon}`);
    }
  }

  if (fm.tags?.length) {
    console.log("");
    console.log(`Tags: ${fm.tags.join(", ")}`);
  }
}

/**
 * awp org list
 */
export async function orgListCommand(options: {
  status?: string;
  kind?: string;
  parent?: string;
}): Promise<void> {
  const root = await requireWorkspaceRoot();

  let orgs = await listOrganizations(root);

  if (options.status) orgs = orgs.filter((o) => o.frontmatter.status === options.status);
  if (options.kind) orgs = orgs.filter((o) => o.frontmatter.kind === options.kind);
  if (options.parent) {
    const parentId = `org:${options.parent}`;
    orgs = orgs.filter((o) => o.frontmatter.parent === parentId);
  }

  if (orgs.length === 0) {
    console.log("No organizations found matching the filters.");
    return;
  }

  const header = "ORG                      KIND       STATUS     PARENT";
  console.log(header);
  console.log("-".repeat(header.length));

  for (const org of orgs) {
    const fm = org.frontmatter;
    const slug = orgIdToSlug(fm.id);
    const parent = fm.parent ? orgIdToSlug(fm.parent) : "(root)";
    console.log(
      `${slug.padEnd(24)} ${fm.kind.padEnd(10)} ${fm.status.padEnd(10)} ${parent}`,
    );
  }
}

/**
 * awp org tree [slug]
 */
export async function orgTreeCommand(slug?: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  const orgs = (await listOrganizations(root)).map((o) => o.frontmatter);
  if (orgs.length === 0) {
    console.log("No organizations found in workspace.");
    return;
  }

  const tree = buildOrgTree(orgs);
  const startId = slug ? `org:${slug}` : tree.root;

  if (!startId || !tree.byId.has(startId)) {
    console.error(slug ? `Organization not found: ${slug}` : "No root organization found.");
    process.exit(1);
  }

  const visited = new Set<string>();
  function render(orgId: string, prefix: string, isLast: boolean, isRoot: boolean): void {
    const org = tree.byId.get(orgId);
    if (!org) return;
    const connector = isRoot ? "" : isLast ? "└─ " : "├─ ";
    if (visited.has(orgId)) {
      console.log(`${prefix}${connector}${org.name} (cycle — already shown)`);
      return;
    }
    visited.add(orgId);
    console.log(`${prefix}${connector}${org.name} (${org.kind}) — ${org.status}`);

    const childPrefix = isRoot ? "" : prefix + (isLast ? "   " : "│  ");
    const children = tree.childrenOf.get(orgId) ?? [];
    children.forEach((childId, idx) => {
      render(childId, childPrefix, idx === children.length - 1, false);
    });
  }

  render(startId, "", true, true);
}

/**
 * awp org update <slug>
 */
export async function orgUpdateCommand(
  slug: string,
  options: { status?: string; mission?: string; accountable?: string; humanOwner?: string },
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const changes: string[] = [];

  if (options.status) {
    if (!VALID_STATUSES.includes(options.status)) {
      console.error(`Invalid status: ${options.status}. Use: ${VALID_STATUSES.join(", ")}`);
      process.exit(1);
    }
    org.frontmatter.status = options.status as OrganizationFrontmatter["status"];
    changes.push(`status -> ${options.status}`);
  }
  if (options.mission) {
    org.frontmatter.mission = options.mission;
    changes.push("mission updated");
  }
  if (options.accountable) {
    org.frontmatter.accountableAgent = options.accountable;
    changes.push(`accountableAgent -> ${options.accountable}`);
  }
  if (options.humanOwner) {
    org.frontmatter.humanOwner = options.humanOwner;
    changes.push(`humanOwner -> ${options.humanOwner}`);
  }

  if (changes.length === 0) {
    console.log("No changes specified.");
    return;
  }

  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");
  console.log(`Updated organization "${slug}": ${changes.join(", ")}`);
}

/**
 * awp org member add <slug> <did>
 */
export async function orgMemberAddCommand(
  slug: string,
  did: string,
  options: { role?: string; repSlug?: string; seat?: string; minReputation?: string[] },
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  if (org.frontmatter.members.some((m) => m.did === did)) {
    console.error(`Agent "${did}" is already a member of "${slug}".`);
    process.exit(1);
  }

  const repSlug = (options.repSlug ?? did.split(":").pop() ?? did).toLowerCase();
  if (!validateSlug(repSlug)) {
    console.error(
      `Could not derive a valid reputation slug from "${did}". Pass --rep-slug explicitly.`,
    );
    process.exit(1);
  }
  const member: OrgMember = {
    did,
    role: options.role ?? "contributor",
    slug: repSlug,
  };
  if (options.seat) {
    if (!["accountable", "contributor", "tool"].includes(options.seat)) {
      console.error(`Invalid seat: ${options.seat}. Use: accountable, contributor, tool`);
      process.exit(1);
    }
    member.seat = options.seat as OrgMember["seat"];
  }
  const minReputation = parseMinReputation(options.minReputation);
  if (Object.keys(minReputation).length > 0) member.minReputation = minReputation;

  org.frontmatter.members.push(member);
  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");

  console.log(`Added member ${repSlug} (${member.role}) to organization "${slug}"`);

  // Advisory reputation-gate check — warn, never block.
  if (member.minReputation) {
    let profile;
    try {
      profile = (await loadProfile(root, repSlug)).frontmatter;
    } catch {
      profile = undefined;
    }
    const warnings = checkMemberGates(member, profile);
    for (const warning of warnings) {
      console.log(`  Warning: ${warning}`);
    }
  }
}

/**
 * awp org member remove <slug> <did>
 */
export async function orgMemberRemoveCommand(slug: string, did: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const before = org.frontmatter.members.length;
  org.frontmatter.members = org.frontmatter.members.filter((m) => m.did !== did);
  if (org.frontmatter.members.length === before) {
    console.error(`Agent "${did}" is not a member of "${slug}".`);
    process.exit(1);
  }

  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");
  console.log(`Removed member ${did} from organization "${slug}"`);
}

/**
 * awp org capability grant <slug> <name>
 */
export async function orgCapabilityGrantCommand(
  slug: string,
  name: string,
  options: {
    description?: string;
    irreversible?: boolean;
    requiresApproval?: boolean;
    approver?: string;
  },
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  if (org.frontmatter.capabilities.some((c) => c.name === name)) {
    console.error(`Capability "${name}" is already granted to "${slug}".`);
    process.exit(1);
  }

  const irreversible = options.irreversible === true;
  // Invariant: irreversible actions always require human approval.
  let requiresApproval = options.requiresApproval === true;
  if (irreversible && !requiresApproval) {
    requiresApproval = true;
    console.log(`Note: "${name}" is irreversible — requiresApproval set to true.`);
  }

  const capability: OrgCapability = { name, irreversible, requiresApproval };
  if (options.description) capability.description = options.description;
  if (options.approver) capability.approver = options.approver;

  org.frontmatter.capabilities.push(capability);
  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");

  console.log(
    `Granted capability "${name}" to "${slug}"` +
      (irreversible ? " (irreversible, requires approval)" : ""),
  );
}

/**
 * awp org capability revoke <slug> <name>
 */
export async function orgCapabilityRevokeCommand(slug: string, name: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const before = org.frontmatter.capabilities.length;
  org.frontmatter.capabilities = org.frontmatter.capabilities.filter((c) => c.name !== name);
  if (org.frontmatter.capabilities.length === before) {
    console.error(`Capability "${name}" is not granted to "${slug}".`);
    process.exit(1);
  }

  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");
  console.log(`Revoked capability "${name}" from organization "${slug}"`);
}

/**
 * awp org capability resolve <slug>
 */
export async function orgCapabilityResolveCommand(slug: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  const orgs = (await listOrganizations(root)).map((o) => o.frontmatter);
  const tree = buildOrgTree(orgs);
  const orgId = `org:${slug}`;
  if (!tree.byId.has(orgId)) {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const { effective, sources } = resolveCapabilities(tree, orgId);

  console.log(`Effective capabilities for ${orgId} (${effective.length})`);
  console.log("-".repeat(40));
  if (effective.length === 0) {
    console.log("  (none)");
    return;
  }
  for (const cap of effective) {
    const origin = cap.inherited ? `inherited from ${sources.get(cap.name)}` : "own grant";
    const flags: string[] = [];
    if (cap.irreversible) flags.push("irreversible");
    if (cap.requiresApproval) flags.push("requires-approval");
    console.log(`  ${cap.name}`);
    console.log(`    ${origin}${flags.length > 0 ? ` — ${flags.join(", ")}` : ""}`);
  }
}

/**
 * awp org budget set <slug>
 */
export async function orgBudgetSetCommand(
  slug: string,
  options: {
    tokens?: string;
    toolCalls?: string;
    spend?: string;
    usedTokens?: string;
    usedToolCalls?: string;
    usedSpend?: string;
    currency?: string;
    period?: string;
  },
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  if (options.period && !["one-time", "daily", "monthly"].includes(options.period)) {
    console.error(`Invalid period: ${options.period}. Use: one-time, daily, monthly`);
    process.exit(1);
  }

  const allocation: Record<string, number> = {};
  for (const [flag, key] of [
    ["tokens", "tokens"],
    ["toolCalls", "toolCalls"],
    ["spend", "spend"],
  ] as const) {
    if (options[flag] !== undefined) {
      allocation[key] = parseNonNegative(options[flag] as string, flag);
    }
  }

  const consumption: Record<string, number> = {};
  for (const [flag, key] of [
    ["usedTokens", "tokens"],
    ["usedToolCalls", "toolCalls"],
    ["usedSpend", "spend"],
  ] as const) {
    if (options[flag] !== undefined) {
      consumption[key] = parseNonNegative(options[flag] as string, flag);
    }
  }

  if (
    Object.keys(allocation).length === 0 &&
    Object.keys(consumption).length === 0 &&
    !options.currency &&
    !options.period
  ) {
    console.log("No budget values specified.");
    return;
  }

  const existing = org.frontmatter.budget;
  org.frontmatter.budget = {
    currency: options.currency ?? existing?.currency ?? "tokens",
    allocation: Object.keys(allocation).length > 0 ? allocation : (existing?.allocation ?? {}),
    consumption:
      Object.keys(consumption).length > 0 ? consumption : (existing?.consumption ?? {}),
    ...(options.period || existing?.period
      ? { period: (options.period ?? existing?.period) as "one-time" | "daily" | "monthly" }
      : {}),
  };

  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");
  console.log(
    `Set budget for "${slug}": allocation ${JSON.stringify(org.frontmatter.budget.allocation)}, ` +
      `consumption ${JSON.stringify(org.frontmatter.budget.consumption)}`,
  );
}

/**
 * awp org authority set <slug>
 */
export async function orgAuthoritySetCommand(
  slug: string,
  options: { canSpawn?: string; maxChildren?: string; maxDepth?: string; canRecruit?: string },
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const existing = org.frontmatter.spawnAuthority;
  const authority: OrgSpawnAuthority = {
    canSpawnKinds: existing?.canSpawnKinds ?? [],
  };
  if (existing?.maxChildren !== undefined) authority.maxChildren = existing.maxChildren;
  if (existing?.maxDepth !== undefined) authority.maxDepth = existing.maxDepth;
  if (existing?.canRecruit !== undefined) authority.canRecruit = existing.canRecruit;

  if (options.canSpawn !== undefined) {
    const kinds = options.canSpawn
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    for (const k of kinds) {
      if (!VALID_KINDS.includes(k as OrgKind)) {
        console.error(`Invalid kind in --can-spawn: ${k}. Use: ${VALID_KINDS.join(", ")}`);
        process.exit(1);
      }
    }
    authority.canSpawnKinds = kinds as OrgKind[];
  }
  if (options.maxChildren !== undefined) {
    authority.maxChildren = parseNonNegative(options.maxChildren, "--max-children");
  }
  if (options.maxDepth !== undefined) {
    authority.maxDepth = parseNonNegative(options.maxDepth, "--max-depth");
  }
  const recruit = parseBoolFlag(options.canRecruit);
  if (recruit !== undefined) authority.canRecruit = recruit;

  org.frontmatter.spawnAuthority = authority;
  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");
  console.log(`Set spawn authority for "${slug}": ${JSON.stringify(authority)}`);
}

/**
 * awp org escalation set <slug>
 */
export async function orgEscalationSetCommand(
  slug: string,
  options: {
    escalateTo?: string;
    confidenceThreshold?: string;
    vetoPower?: string;
    autoEscalateIrreversible?: string;
  },
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const escalation: OrgEscalation = { ...(org.frontmatter.escalation ?? {}) };

  if (options.escalateTo !== undefined) escalation.escalateTo = options.escalateTo;
  if (options.confidenceThreshold !== undefined) {
    const t = Number(options.confidenceThreshold);
    if (isNaN(t) || t < 0 || t > 1) {
      console.error("Invalid --confidence-threshold: must be 0.0-1.0.");
      process.exit(1);
    }
    escalation.confidenceThreshold = t;
  }
  const veto = parseBoolFlag(options.vetoPower);
  if (veto !== undefined) escalation.vetoPower = veto;
  const auto = parseBoolFlag(options.autoEscalateIrreversible);
  if (auto !== undefined) escalation.autoEscalateIrreversible = auto;

  org.frontmatter.escalation = escalation;
  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");
  console.log(`Set escalation config for "${slug}": ${JSON.stringify(escalation)}`);
}

/**
 * awp org kpi set <slug> <name>
 */
export async function orgKpiSetCommand(
  slug: string,
  name: string,
  options: { target?: string; current?: string; unit?: string; direction?: string },
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let org;
  try {
    org = await loadOrganization(root, slug);
  } catch {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const kpis = org.frontmatter.kpis ?? [];
  const existing = kpis.find((k) => k.name === name);

  const target =
    options.target !== undefined ? Number(options.target) : existing?.target;
  if (target === undefined || isNaN(target)) {
    console.error(`A numeric --target is required to define KPI "${name}".`);
    process.exit(1);
  }

  if (options.direction && !["higher-is-better", "lower-is-better"].includes(options.direction)) {
    console.error(
      `Invalid --direction: ${options.direction}. Use: higher-is-better, lower-is-better`,
    );
    process.exit(1);
  }

  const kpi: OrgKPI = { name, target };
  const current = options.current !== undefined ? Number(options.current) : existing?.current;
  if (current !== undefined && !isNaN(current)) kpi.current = current;
  const unit = options.unit ?? existing?.unit;
  if (unit) kpi.unit = unit;
  const direction = options.direction ?? existing?.direction;
  if (direction) kpi.direction = direction as OrgKPI["direction"];

  const next = kpis.filter((k) => k.name !== name);
  next.push(kpi);
  org.frontmatter.kpis = next;

  await writeFile(org.filePath, serializeWorkspaceFile(org), "utf-8");
  console.log(`${existing ? "Updated" : "Added"} KPI "${name}" on organization "${slug}"`);
}

/**
 * awp org budget report [slug]
 */
export async function orgBudgetReportCommand(slug?: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  const orgs = (await listOrganizations(root)).map((o) => o.frontmatter);
  if (orgs.length === 0) {
    console.log("No organizations found in workspace.");
    return;
  }

  const tree = buildOrgTree(orgs);
  const orgId = slug ? `org:${slug}` : tree.root;
  if (!orgId || !tree.byId.has(orgId)) {
    console.error(slug ? `Organization not found: ${slug}` : "No root organization found.");
    process.exit(1);
  }

  const reportFor = [orgId, ...getDescendants(tree, orgId).map((o) => o.id)];

  console.log(`Budget report — subtree of ${orgId}`);
  console.log("-".repeat(60));
  for (const id of reportFor) {
    const rollup = rollupBudget(tree, id);
    const status = rollup.overBudget ? `OVER (${rollup.exceededLines.join(", ")})` : "ok";
    console.log(`${id}`);
    console.log(`  allocation:  ${JSON.stringify(rollup.allocation)}`);
    console.log(`  own usage:   ${JSON.stringify(rollup.ownConsumption)}`);
    console.log(`  subtree use: ${JSON.stringify(rollup.subtreeConsumption)} [${status}]`);
  }
}

/**
 * awp org escalate <slug>
 */
export async function orgEscalateCommand(slug: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  const orgs = (await listOrganizations(root)).map((o) => o.frontmatter);
  const tree = buildOrgTree(orgs);
  const orgId = `org:${slug}`;
  if (!tree.byId.has(orgId)) {
    console.error(`Organization not found: ${slug}`);
    process.exit(1);
  }

  const path = resolveEscalationPath(tree, orgId);
  const approver = resolveApprover(tree, orgId);

  console.log(`Escalation path for ${orgId}`);
  console.log("-".repeat(40));
  path.forEach((step, idx) => {
    const arrow = idx === 0 ? "" : "  -> ";
    console.log(`${arrow}${step.orgId}`);
    console.log(`     accountable: ${step.accountableAgent}`);
    console.log(`     human owner: ${step.humanOwner}`);
    if (step.escalateTo) console.log(`     escalateTo:  ${step.escalateTo} (short-circuit)`);
  });
  console.log("");
  console.log(`Approver for irreversible actions: ${approver}`);
}

/**
 * awp org validate
 */
export async function orgValidateCommand(): Promise<void> {
  const root = await requireWorkspaceRoot();

  const orgs = (await listOrganizations(root)).map((o) => o.frontmatter);
  if (orgs.length === 0) {
    console.log("No organizations found in workspace.");
    return;
  }

  const issues = validateOrgStructure(orgs);
  if (issues.length === 0) {
    console.log(`Organization structure OK — ${orgs.length} unit(s), no issues.`);
    return;
  }

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");

  for (const issue of issues) {
    const tag = issue.severity === "error" ? "[ERROR]" : "[WARN] ";
    console.log(`  ${tag} ${issue.orgId || "(structure)"} — ${issue.message}`);
  }
  console.log("");
  console.log(`${errors.length} error(s), ${warnings.length} warning(s).`);
  if (errors.length > 0) process.exit(1);
}
