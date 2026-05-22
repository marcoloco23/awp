import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as z from "zod";
import { AWP_VERSION, OGP_VERSION, ORGANIZATIONS_DIR, MANIFEST_PATH } from "@agent-workspace/core";
import type { OrganizationFrontmatter, OrgKind } from "@agent-workspace/core";
import {
  getWorkspaceRoot,
  buildOrgTree,
  resolveCapabilities,
  rollupBudget,
  resolveEscalationPath,
  resolveApprover,
  canSpawnChild,
  getDescendants,
  getOrgSummary,
  validateOrgStructure,
} from "@agent-workspace/utils";

type Json = Record<string, unknown>;

function ok(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text }] };
}

function err(text: string): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  return { content: [{ type: "text" as const, text }], isError: true };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Load every organization unit in the workspace. */
async function loadAllOrganizations(root: string): Promise<OrganizationFrontmatter[]> {
  const orgsDir = join(root, ORGANIZATIONS_DIR);
  const orgs: OrganizationFrontmatter[] = [];

  let files: string[];
  try {
    files = await readdir(orgsDir);
  } catch {
    return orgs;
  }

  for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
    try {
      const raw = await readFile(join(orgsDir, f), "utf-8");
      const { data } = matter(raw);
      if (data.type === "organization") {
        orgs.push(data as OrganizationFrontmatter);
      }
    } catch {
      /* skip unparseable */
    }
  }

  return orgs;
}

/** Read the workspace agent DID from the manifest, if available. */
async function getManifestAgentDid(root: string): Promise<string> {
  try {
    const raw = await readFile(join(root, MANIFEST_PATH), "utf-8");
    const manifest = JSON.parse(raw) as { agent?: { did?: string } };
    return manifest.agent?.did ?? "did:awp:unknown";
  } catch {
    return "did:awp:unknown";
  }
}

interface OrgTreeJson {
  id: string;
  name: string;
  kind: string;
  status: string;
  children: OrgTreeJson[];
}

function toTreeJson(
  tree: ReturnType<typeof buildOrgTree>,
  orgId: string,
  visited: Set<string> = new Set(),
): OrgTreeJson | null {
  const org = tree.byId.get(orgId);
  if (!org || visited.has(orgId)) return null;
  visited.add(orgId);
  return {
    id: org.id,
    name: org.name,
    kind: org.kind,
    status: org.status,
    children: (tree.childrenOf.get(orgId) ?? [])
      .map((childId) => toTreeJson(tree, childId, visited))
      .filter((c): c is OrgTreeJson => c !== null),
  };
}

/**
 * Register organization (OGP) tools.
 */
export function registerOrganizationTools(server: McpServer): void {
  // --- awp_org_create ---
  server.registerTool(
    "awp_org_create",
    {
      title: "Create Organization",
      description: "Create a new organization unit in the recursive machine org chart (OGP).",
      inputSchema: {
        slug: z.string().describe("Organization slug (e.g., 'acme', 'engineering')"),
        name: z.string().optional().describe("Organization name"),
        kind: z.enum(["org", "division", "team"]).describe("Unit tier"),
        mission: z.string().describe("One-line mission of the unit"),
        parent: z.string().optional().describe("Parent organization slug"),
        accountableAgent: z
          .string()
          .optional()
          .describe("DID of the accountable agent (defaults to the workspace agent)"),
        humanOwner: z
          .string()
          .optional()
          .describe("User ID of the human owner (e.g., 'user:marc')"),
      },
    },
    async ({ slug, name, kind, mission, parent, accountableAgent, humanOwner }) => {
      const root = getWorkspaceRoot();
      const orgsDir = join(root, ORGANIZATIONS_DIR);
      await mkdir(orgsDir, { recursive: true });

      const filePath = join(orgsDir, `${slug}.md`);
      if (await fileExists(filePath)) {
        return err(`Organization "${slug}" already exists.`);
      }

      const parentId = parent ? `org:${parent}` : null;
      const warnings: string[] = [];

      if (parentId) {
        const orgs = await loadAllOrganizations(root);
        const tree = buildOrgTree(orgs);
        if (!tree.byId.has(parentId)) {
          return err(`Parent organization "${parentId}" not found.`);
        }
        const check = canSpawnChild(tree, parentId, kind as OrgKind);
        if (!check.allowed) warnings.push(...check.reasons);
      }

      const now = new Date().toISOString();
      const orgName =
        name ||
        slug
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      const data: Json = {
        awp: AWP_VERSION,
        ogp: OGP_VERSION,
        type: "organization",
        id: `org:${slug}`,
        name: orgName,
        kind,
        mission,
        status: "forming",
        created: now,
        parent: parentId,
        children: [],
        accountableAgent: accountableAgent || (await getManifestAgentDid(root)),
        humanOwner: humanOwner || "user:owner",
        members: [],
        capabilities: [],
      };

      const body = `\n# ${orgName}\n\n${mission}\n`;
      await writeFile(filePath, matter.stringify(body, data), "utf-8");

      // Keep the parent's denormalized children[] in sync.
      if (parentId) {
        const parentPath = join(orgsDir, `${parent}.md`);
        try {
          const raw = await readFile(parentPath, "utf-8");
          const parsed = matter(raw);
          const children = (parsed.data.children as string[]) ?? [];
          if (!children.includes(`org:${slug}`)) {
            children.push(`org:${slug}`);
            parsed.data.children = children;
            await writeFile(parentPath, matter.stringify(parsed.content, parsed.data), "utf-8");
          }
        } catch {
          warnings.push(`Could not update parent "${parentId}" children[].`);
        }
      }

      return ok(
        JSON.stringify(
          {
            created: `organizations/${slug}.md`,
            kind,
            status: "forming",
            spawnWarnings: warnings,
          },
          null,
          2,
        ),
      );
    },
  );

  // --- awp_org_list ---
  server.registerTool(
    "awp_org_list",
    {
      title: "List Organizations",
      description: "List organization units with optional status and kind filters.",
      inputSchema: {
        status: z.string().optional().describe("Filter by status"),
        kind: z.string().optional().describe("Filter by kind (org, division, team)"),
      },
    },
    async ({ status, kind }) => {
      const root = getWorkspaceRoot();
      let orgs = await loadAllOrganizations(root);
      if (status) orgs = orgs.filter((o) => o.status === status);
      if (kind) orgs = orgs.filter((o) => o.kind === kind);

      return ok(
        JSON.stringify(
          {
            organizations: orgs.map((o) => ({
              id: o.id,
              name: o.name,
              kind: o.kind,
              status: o.status,
              parent: o.parent,
              children: o.children,
              memberCount: o.members?.length ?? 0,
            })),
          },
          null,
          2,
        ),
      );
    },
  );

  // --- awp_org_show ---
  server.registerTool(
    "awp_org_show",
    {
      title: "Show Organization",
      description: "Show an organization unit with members, effective capabilities, and budget.",
      inputSchema: { slug: z.string().describe("Organization slug") },
    },
    async ({ slug }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const orgs = await loadAllOrganizations(root);
      const tree = buildOrgTree(orgs);
      const orgId = `org:${slug}`;
      const resolved = resolveCapabilities(tree, orgId);
      const summary = getOrgSummary(tree, orgId);

      return ok(
        JSON.stringify(
          {
            frontmatter: parsed.data,
            body: parsed.content.trim(),
            effectiveCapabilities: resolved.effective,
            summary,
          },
          null,
          2,
        ),
      );
    },
  );

  // --- awp_org_tree ---
  server.registerTool(
    "awp_org_tree",
    {
      title: "Organization Tree",
      description: "Return the org chart as a nested tree, from the root or a given subtree.",
      inputSchema: {
        slug: z.string().optional().describe("Subtree root slug (defaults to the root org)"),
      },
    },
    async ({ slug }) => {
      const root = getWorkspaceRoot();
      const orgs = await loadAllOrganizations(root);
      if (orgs.length === 0) return ok(JSON.stringify({ tree: null }, null, 2));

      const tree = buildOrgTree(orgs);
      const startId = slug ? `org:${slug}` : tree.root;
      if (!startId || !tree.byId.has(startId)) {
        return err(slug ? `Organization "${slug}" not found.` : "No root organization found.");
      }

      return ok(JSON.stringify({ tree: toTreeJson(tree, startId) }, null, 2));
    },
  );

  // --- awp_org_update ---
  server.registerTool(
    "awp_org_update",
    {
      title: "Update Organization",
      description: "Update an organization's status, mission, accountable agent, or human owner.",
      inputSchema: {
        slug: z.string().describe("Organization slug"),
        status: z.enum(["forming", "active", "paused", "dissolved"]).optional(),
        mission: z.string().optional(),
        accountableAgent: z.string().optional(),
        humanOwner: z.string().optional(),
      },
    },
    async ({ slug, status, mission, accountableAgent, humanOwner }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const changes: string[] = [];
      if (status) {
        parsed.data.status = status;
        changes.push(`status -> ${status}`);
      }
      if (mission) {
        parsed.data.mission = mission;
        changes.push("mission updated");
      }
      if (accountableAgent) {
        parsed.data.accountableAgent = accountableAgent;
        changes.push("accountableAgent updated");
      }
      if (humanOwner) {
        parsed.data.humanOwner = humanOwner;
        changes.push("humanOwner updated");
      }

      if (changes.length === 0) return ok("No changes specified.");

      await writeFile(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return ok(`Updated organization "${slug}": ${changes.join(", ")}`);
    },
  );

  // --- awp_org_member_add ---
  server.registerTool(
    "awp_org_member_add",
    {
      title: "Add Organization Member",
      description: "Add a member agent to an organization unit.",
      inputSchema: {
        slug: z.string().describe("Organization slug"),
        did: z.string().describe("Member agent DID"),
        role: z.string().describe("Role within the unit"),
        repSlug: z.string().describe("Reputation profile slug"),
        seat: z.enum(["accountable", "contributor", "tool"]).optional(),
        minReputation: z
          .record(z.string(), z.number())
          .optional()
          .describe("Map of dimension/domain to minimum score"),
      },
    },
    async ({ slug, did, role, repSlug, seat, minReputation }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const members = (parsed.data.members as Json[]) ?? [];
      if (members.some((m) => m.did === did)) {
        return err(`Agent "${did}" is already a member of "${slug}".`);
      }

      const member: Json = { did, role, slug: repSlug };
      if (seat) member.seat = seat;
      if (minReputation && Object.keys(minReputation).length > 0) {
        member.minReputation = minReputation;
      }
      members.push(member);
      parsed.data.members = members;

      await writeFile(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return ok(`Added member ${repSlug} (${role}) to organization "${slug}"`);
    },
  );

  // --- awp_org_member_remove ---
  server.registerTool(
    "awp_org_member_remove",
    {
      title: "Remove Organization Member",
      description: "Remove a member agent from an organization unit.",
      inputSchema: {
        slug: z.string().describe("Organization slug"),
        did: z.string().describe("Member agent DID"),
      },
    },
    async ({ slug, did }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const members = (parsed.data.members as Json[]) ?? [];
      const filtered = members.filter((m) => m.did !== did);
      if (filtered.length === members.length) {
        return err(`Agent "${did}" is not a member of "${slug}".`);
      }
      parsed.data.members = filtered;

      await writeFile(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return ok(`Removed member ${did} from organization "${slug}"`);
    },
  );

  // --- awp_org_capability_grant ---
  server.registerTool(
    "awp_org_capability_grant",
    {
      title: "Grant Organization Capability",
      description:
        "Grant a capability to an organization. Irreversible capabilities MUST require approval.",
      inputSchema: {
        slug: z.string().describe("Organization slug"),
        name: z.string().describe("Capability name (e.g., 'deploy:production')"),
        description: z.string().optional(),
        irreversible: z.boolean().describe("Whether the action cannot be undone"),
        requiresApproval: z.boolean().describe("Whether a human must approve each use"),
        approver: z.string().optional().describe("Approver user ID"),
      },
    },
    async ({ slug, name, description, irreversible, requiresApproval, approver }) => {
      if (irreversible && !requiresApproval) {
        return err(
          `Capability "${name}" is irreversible — requiresApproval must be true. ` +
            `Irreversible actions cannot be granted without human approval.`,
        );
      }

      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const capabilities = (parsed.data.capabilities as Json[]) ?? [];
      if (capabilities.some((c) => c.name === name)) {
        return err(`Capability "${name}" is already granted to "${slug}".`);
      }

      const capability: Json = { name, irreversible, requiresApproval };
      if (description) capability.description = description;
      if (approver) capability.approver = approver;
      capabilities.push(capability);
      parsed.data.capabilities = capabilities;

      await writeFile(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return ok(`Granted capability "${name}" to organization "${slug}"`);
    },
  );

  // --- awp_org_capability_resolve ---
  server.registerTool(
    "awp_org_capability_resolve",
    {
      title: "Resolve Organization Capabilities",
      description: "Show the effective capabilities of a unit (own + inherited from ancestors).",
      inputSchema: { slug: z.string().describe("Organization slug") },
    },
    async ({ slug }) => {
      const root = getWorkspaceRoot();
      const orgs = await loadAllOrganizations(root);
      const tree = buildOrgTree(orgs);
      const orgId = `org:${slug}`;
      if (!tree.byId.has(orgId)) {
        return err(`Organization "${slug}" not found.`);
      }

      const { effective, sources } = resolveCapabilities(tree, orgId);
      return ok(
        JSON.stringify(
          {
            orgId,
            effective: effective.map((cap) => ({
              ...cap,
              source: sources.get(cap.name) ?? orgId,
            })),
          },
          null,
          2,
        ),
      );
    },
  );

  // --- awp_org_budget_set ---
  server.registerTool(
    "awp_org_budget_set",
    {
      title: "Set Organization Budget",
      description: "Set an organization's budget allocation and/or recorded consumption.",
      inputSchema: {
        slug: z.string().describe("Organization slug"),
        tokens: z.number().optional().describe("Token allocation"),
        toolCalls: z.number().optional().describe("Tool-call allocation"),
        spend: z.number().optional().describe("Spend allocation"),
        consumedTokens: z.number().optional().describe("Recorded token consumption"),
        consumedToolCalls: z.number().optional().describe("Recorded tool-call consumption"),
        consumedSpend: z.number().optional().describe("Recorded spend consumption"),
        currency: z.string().optional(),
        period: z.enum(["one-time", "daily", "monthly"]).optional(),
      },
    },
    async ({
      slug,
      tokens,
      toolCalls,
      spend,
      consumedTokens,
      consumedToolCalls,
      consumedSpend,
      currency,
      period,
    }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const existing = (parsed.data.budget as Json | undefined) ?? {};
      const allocation: Json = {};
      if (tokens !== undefined) allocation.tokens = tokens;
      if (toolCalls !== undefined) allocation.toolCalls = toolCalls;
      if (spend !== undefined) allocation.spend = spend;

      const consumption: Json = {};
      if (consumedTokens !== undefined) consumption.tokens = consumedTokens;
      if (consumedToolCalls !== undefined) consumption.toolCalls = consumedToolCalls;
      if (consumedSpend !== undefined) consumption.spend = consumedSpend;

      const budget: Json = {
        currency: currency ?? existing.currency ?? "tokens",
        allocation:
          Object.keys(allocation).length > 0
            ? allocation
            : ((existing.allocation as Json) ?? {}),
        consumption:
          Object.keys(consumption).length > 0
            ? consumption
            : ((existing.consumption as Json) ?? {}),
      };
      if (period ?? existing.period) budget.period = period ?? existing.period;
      parsed.data.budget = budget;

      await writeFile(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return ok(
        JSON.stringify({ updated: `organizations/${slug}.md`, budget }, null, 2),
      );
    },
  );

  // --- awp_org_authority_set ---
  server.registerTool(
    "awp_org_authority_set",
    {
      title: "Set Organization Spawn Authority",
      description: "Set what sub-units and recruitment an organization is authorized to create.",
      inputSchema: {
        slug: z.string().describe("Organization slug"),
        canSpawnKinds: z
          .array(z.enum(["org", "division", "team"]))
          .optional()
          .describe("Kinds this unit may spawn as children"),
        maxChildren: z.number().optional().describe("Cap on direct children"),
        maxDepth: z.number().optional().describe("Maximum absolute tree depth for descendants"),
        canRecruit: z.boolean().optional().describe("Whether the unit may recruit members"),
      },
    },
    async ({ slug, canSpawnKinds, maxChildren, maxDepth, canRecruit }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const existing = (parsed.data.spawnAuthority as Json | undefined) ?? {};
      const authority: Json = {
        canSpawnKinds: canSpawnKinds ?? existing.canSpawnKinds ?? [],
      };
      const mc = maxChildren ?? existing.maxChildren;
      if (mc !== undefined) authority.maxChildren = mc;
      const md = maxDepth ?? existing.maxDepth;
      if (md !== undefined) authority.maxDepth = md;
      const cr = canRecruit ?? existing.canRecruit;
      if (cr !== undefined) authority.canRecruit = cr;

      parsed.data.spawnAuthority = authority;
      await writeFile(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return ok(JSON.stringify({ updated: `organizations/${slug}.md`, spawnAuthority: authority }, null, 2));
    },
  );

  // --- awp_org_escalation_set ---
  server.registerTool(
    "awp_org_escalation_set",
    {
      title: "Set Organization Escalation Config",
      description: "Set an organization's approval / exception routing config.",
      inputSchema: {
        slug: z.string().describe("Organization slug"),
        escalateTo: z.string().optional().describe("Explicit escalation target DID/user ID"),
        confidenceThreshold: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Auto-escalate below this confidence"),
        vetoPower: z.boolean().optional().describe("Whether the human owner can veto"),
        autoEscalateIrreversible: z
          .boolean()
          .optional()
          .describe("Auto-escalate every irreversible action"),
      },
    },
    async ({ slug, escalateTo, confidenceThreshold, vetoPower, autoEscalateIrreversible }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const escalation: Json = { ...((parsed.data.escalation as Json | undefined) ?? {}) };
      if (escalateTo !== undefined) escalation.escalateTo = escalateTo;
      if (confidenceThreshold !== undefined) escalation.confidenceThreshold = confidenceThreshold;
      if (vetoPower !== undefined) escalation.vetoPower = vetoPower;
      if (autoEscalateIrreversible !== undefined) {
        escalation.autoEscalateIrreversible = autoEscalateIrreversible;
      }

      parsed.data.escalation = escalation;
      await writeFile(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return ok(JSON.stringify({ updated: `organizations/${slug}.md`, escalation }, null, 2));
    },
  );

  // --- awp_org_kpi_set ---
  server.registerTool(
    "awp_org_kpi_set",
    {
      title: "Set Organization KPI",
      description: "Add or update a KPI on an organization unit.",
      inputSchema: {
        slug: z.string().describe("Organization slug"),
        name: z.string().describe("KPI name"),
        target: z.number().describe("Goal value"),
        current: z.number().optional().describe("Latest measured value"),
        unit: z.string().optional().describe("Unit of measure"),
        direction: z.enum(["higher-is-better", "lower-is-better"]).optional(),
      },
    },
    async ({ slug, name, target, current, unit, direction }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, ORGANIZATIONS_DIR, `${slug}.md`);

      let parsed: { data: Json; content: string };
      try {
        parsed = matter(await readFile(filePath, "utf-8"));
      } catch {
        return err(`Organization "${slug}" not found.`);
      }

      const kpis = (parsed.data.kpis as Json[]) ?? [];
      const kpi: Json = { name, target };
      if (current !== undefined) kpi.current = current;
      if (unit !== undefined) kpi.unit = unit;
      if (direction !== undefined) kpi.direction = direction;

      const existed = kpis.some((k) => k.name === name);
      parsed.data.kpis = [...kpis.filter((k) => k.name !== name), kpi];

      await writeFile(filePath, matter.stringify(parsed.content, parsed.data), "utf-8");
      return ok(`${existed ? "Updated" : "Added"} KPI "${name}" on organization "${slug}"`);
    },
  );

  // --- awp_org_budget_report ---
  server.registerTool(
    "awp_org_budget_report",
    {
      title: "Organization Budget Report",
      description: "Report budget allocation vs subtree consumption for a unit and descendants.",
      inputSchema: {
        slug: z.string().optional().describe("Subtree root slug (defaults to the root org)"),
      },
    },
    async ({ slug }) => {
      const root = getWorkspaceRoot();
      const orgs = await loadAllOrganizations(root);
      if (orgs.length === 0) return ok(JSON.stringify({ rollups: [] }, null, 2));

      const tree = buildOrgTree(orgs);
      const startId = slug ? `org:${slug}` : tree.root;
      if (!startId || !tree.byId.has(startId)) {
        return err(slug ? `Organization "${slug}" not found.` : "No root organization found.");
      }

      const ids = [startId, ...getDescendants(tree, startId).map((o) => o.id)];
      const rollups = ids.map((id) => rollupBudget(tree, id));
      return ok(JSON.stringify({ rollups }, null, 2));
    },
  );

  // --- awp_org_escalate ---
  server.registerTool(
    "awp_org_escalate",
    {
      title: "Resolve Organization Escalation Path",
      description: "Resolve the escalation path up to the accountable human owner.",
      inputSchema: { slug: z.string().describe("Organization slug") },
    },
    async ({ slug }) => {
      const root = getWorkspaceRoot();
      const orgs = await loadAllOrganizations(root);
      const tree = buildOrgTree(orgs);
      const orgId = `org:${slug}`;
      if (!tree.byId.has(orgId)) {
        return err(`Organization "${slug}" not found.`);
      }

      return ok(
        JSON.stringify(
          {
            orgId,
            path: resolveEscalationPath(tree, orgId),
            approver: resolveApprover(tree, orgId),
          },
          null,
          2,
        ),
      );
    },
  );

  // --- awp_org_validate ---
  server.registerTool(
    "awp_org_validate",
    {
      title: "Validate Organization Structure",
      description:
        "Check org-chart structural integrity: single root, cycles, reference drift, invariants.",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const orgs = await loadAllOrganizations(root);
      const issues = validateOrgStructure(orgs);
      return ok(
        JSON.stringify(
          {
            unitCount: orgs.length,
            errors: issues.filter((i) => i.severity === "error"),
            warnings: issues.filter((i) => i.severity === "warning"),
          },
          null,
          2,
        ),
      );
    },
  );
}
