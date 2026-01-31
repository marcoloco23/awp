import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as z from "zod";
import { AWP_VERSION, CDP_VERSION, SWARMS_DIR, REPUTATION_DIR } from "@agent-workspace/core";
import type { SwarmRole, ReputationProfileFrontmatter } from "@agent-workspace/core";
import {
  getWorkspaceRoot,
  getAgentDid,
  findCandidatesForRole,
  autoRecruitSwarm,
  getSwarmStaffingSummary,
} from "@agent-workspace/utils";

/**
 * Check if a file exists at the given path.
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load all reputation profiles from the workspace.
 */
async function loadReputationProfiles(root: string): Promise<ReputationProfileFrontmatter[]> {
  const repDir = join(root, REPUTATION_DIR);
  const profiles: ReputationProfileFrontmatter[] = [];

  let files: string[];
  try {
    files = await readdir(repDir);
  } catch {
    return profiles;
  }

  for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
    try {
      const raw = await readFile(join(repDir, f), "utf-8");
      const { data } = matter(raw);
      if (data.type === "reputation-profile") {
        profiles.push(data as ReputationProfileFrontmatter);
      }
    } catch {
      /* skip */
    }
  }

  return profiles;
}

/**
 * Register swarm-related tools
 */
export function registerSwarmTools(server: McpServer): void {
  // --- Tool: awp_swarm_create ---
  server.registerTool(
    "awp_swarm_create",
    {
      title: "Create Swarm",
      description: "Create a new multi-agent swarm for coordination.",
      inputSchema: {
        slug: z.string().describe("Swarm slug (e.g., 'q3-launch-team')"),
        name: z.string().optional().describe("Swarm name"),
        goal: z.string().describe("Swarm goal/objective"),
        projectId: z.string().optional().describe("Optional linked project ID"),
        humanLead: z.string().optional().describe("Human lead user ID"),
        vetoPower: z.boolean().optional().describe("Human veto power"),
      },
    },
    async ({ slug, name, goal, projectId, humanLead, vetoPower }) => {
      const root = getWorkspaceRoot();
      const swarmsDir = join(root, SWARMS_DIR);
      await mkdir(swarmsDir, { recursive: true });

      const filePath = join(swarmsDir, `${slug}.md`);
      if (await fileExists(filePath)) {
        return {
          content: [{ type: "text" as const, text: `Swarm "${slug}" already exists.` }],
          isError: true,
        };
      }

      const now = new Date().toISOString();
      const swarmName =
        name ||
        slug
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      const data: Record<string, unknown> = {
        awp: AWP_VERSION,
        cdp: CDP_VERSION,
        type: "swarm",
        id: `swarm:${slug}`,
        name: swarmName,
        goal,
        status: "recruiting",
        created: now,
        roles: [],
      };

      if (projectId) data.projectId = projectId;

      if (humanLead || vetoPower !== undefined) {
        const governance: Record<string, unknown> = {};
        if (humanLead) governance.humanLead = humanLead;
        if (vetoPower !== undefined) governance.vetoPower = vetoPower;
        data.governance = governance;
      }

      const body = `\n# ${swarmName}\n\n${goal}\n`;
      const output = matter.stringify(body, data);
      await writeFile(filePath, output, "utf-8");

      return {
        content: [
          { type: "text" as const, text: `Created swarms/${slug}.md (status: recruiting)` },
        ],
      };
    }
  );

  // --- Tool: awp_swarm_list ---
  server.registerTool(
    "awp_swarm_list",
    {
      title: "List Swarms",
      description: "List all swarms with optional status filter.",
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe("Filter by status (recruiting, active, completed, disbanded)"),
      },
    },
    async ({ status: statusFilter }) => {
      const root = getWorkspaceRoot();
      const swarmsDir = join(root, SWARMS_DIR);

      let files: string[];
      try {
        files = await readdir(swarmsDir);
      } catch {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ swarms: [] }, null, 2) }],
        };
      }

      const swarms: Record<string, unknown>[] = [];
      for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
        try {
          const raw = await readFile(join(swarmsDir, f), "utf-8");
          const { data } = matter(raw);
          if (data.type !== "swarm") continue;
          if (statusFilter && data.status !== statusFilter) continue;

          const roles = data.roles as SwarmRole[] | undefined;
          let filled = 0;
          let total = 0;
          for (const role of roles || []) {
            filled += role.assigned?.length || 0;
            total += role.count || 0;
          }

          swarms.push({
            slug: f.replace(/\.md$/, ""),
            name: data.name,
            goal: data.goal,
            status: data.status,
            staffing: { filled, total },
            projectId: data.projectId,
          });
        } catch {
          /* skip */
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ swarms }, null, 2) }],
      };
    }
  );

  // --- Tool: awp_swarm_show ---
  server.registerTool(
    "awp_swarm_show",
    {
      title: "Show Swarm",
      description: "Show swarm details including roles and staffing.",
      inputSchema: {
        slug: z.string().describe("Swarm slug"),
      },
    },
    async ({ slug }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, SWARMS_DIR, `${slug}.md`);

      try {
        const raw = await readFile(filePath, "utf-8");
        const { data, content } = matter(raw);

        // Cast to proper type for staffing calculation
        const roles = data.roles as SwarmRole[] | undefined;
        let filled = 0;
        let total = 0;
        const rolesSummary = [];
        for (const role of roles || []) {
          const roleFilled = role.assigned?.length || 0;
          filled += roleFilled;
          total += role.count || 0;
          rolesSummary.push({
            name: role.name,
            count: role.count,
            assigned: role.assigned,
            assignedSlugs: role.assignedSlugs,
            minReputation: role.minReputation,
            filled: roleFilled,
          });
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  frontmatter: data,
                  body: content.trim(),
                  staffing: { filled, total },
                  roles: rolesSummary,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch {
        return {
          content: [{ type: "text" as const, text: `Swarm "${slug}" not found.` }],
          isError: true,
        };
      }
    }
  );

  // --- Tool: awp_swarm_recruit ---
  server.registerTool(
    "awp_swarm_recruit",
    {
      title: "Recruit for Swarm",
      description:
        "Find candidates for unfilled swarm roles. Use auto=true to automatically assign best candidates.",
      inputSchema: {
        slug: z.string().describe("Swarm slug"),
        auto: z.boolean().optional().describe("Auto-assign qualified candidates"),
      },
    },
    async ({ slug, auto }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, SWARMS_DIR, `${slug}.md`);

      let swarmData: { data: Record<string, unknown>; content: string };
      try {
        const raw = await readFile(filePath, "utf-8");
        swarmData = matter(raw);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Swarm "${slug}" not found.` }],
          isError: true,
        };
      }

      const profiles = await loadReputationProfiles(root);
      const now = new Date();
      const roles = swarmData.data.roles as SwarmRole[];

      if (!roles || roles.length === 0) {
        return {
          content: [{ type: "text" as const, text: "Swarm has no roles defined." }],
        };
      }

      if (auto) {
        // Auto-recruit
        const swarmFm =
          swarmData.data as unknown as import("@agent-workspace/core").SwarmFrontmatter;
        const results = autoRecruitSwarm(swarmFm, profiles, now);

        let anyAssigned = false;
        for (const result of results) {
          if (result.assigned.length > 0) {
            anyAssigned = true;
            const role = roles.find((r: SwarmRole) => r.name === result.role);
            if (role) {
              role.assigned.push(...result.assigned);
              if (!role.assignedSlugs) role.assignedSlugs = [];
              role.assignedSlugs.push(...result.assignedSlugs);
            }
          }
        }

        if (anyAssigned) {
          // Check if fully staffed
          const summary = getSwarmStaffingSummary(swarmFm);
          if (summary.needed === 0 && swarmData.data.status === "recruiting") {
            swarmData.data.status = "active";
          }

          const output = matter.stringify(swarmData.content, swarmData.data);
          await writeFile(filePath, output, "utf-8");
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { recruited: anyAssigned, results, newStatus: swarmData.data.status },
                null,
                2
              ),
            },
          ],
        };
      }

      // Show candidates
      const candidatesByRole: Record<string, unknown>[] = [];
      for (const role of roles) {
        const candidates = findCandidatesForRole(role, profiles, now);
        candidatesByRole.push({
          role: role.name,
          count: role.count,
          filled: role.assigned?.length || 0,
          candidates: candidates.map((c) => ({
            slug: c.slug,
            did: c.did,
            name: c.name,
            scores: c.scores,
            qualifies: c.qualifies,
            gaps: c.gaps,
          })),
        });
      }

      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ roles: candidatesByRole }, null, 2) },
        ],
      };
    }
  );

  // --- Tool: awp_swarm_assign ---
  server.registerTool(
    "awp_swarm_assign",
    {
      title: "Assign Agent to Swarm Role",
      description: "Manually assign an agent to a swarm role.",
      inputSchema: {
        slug: z.string().describe("Swarm slug"),
        role: z.string().describe("Role name"),
        agentDid: z.string().describe("Agent DID to assign"),
        agentSlug: z.string().describe("Agent reputation profile slug"),
      },
    },
    async ({ slug, role: roleName, agentDid, agentSlug }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, SWARMS_DIR, `${slug}.md`);

      let swarmData: { data: Record<string, unknown>; content: string };
      try {
        const raw = await readFile(filePath, "utf-8");
        swarmData = matter(raw);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Swarm "${slug}" not found.` }],
          isError: true,
        };
      }

      const roles = swarmData.data.roles as SwarmRole[];
      const role = roles?.find((r: SwarmRole) => r.name === roleName);

      if (!role) {
        return {
          content: [{ type: "text" as const, text: `Role "${roleName}" not found in swarm.` }],
          isError: true,
        };
      }

      if (role.assigned.includes(agentDid)) {
        return {
          content: [{ type: "text" as const, text: `Agent already assigned to role.` }],
          isError: true,
        };
      }

      if (role.assigned.length >= role.count) {
        return {
          content: [
            { type: "text" as const, text: `Role "${roleName}" is already fully staffed.` },
          ],
          isError: true,
        };
      }

      role.assigned.push(agentDid);
      if (!role.assignedSlugs) role.assignedSlugs = [];
      role.assignedSlugs.push(agentSlug);

      // Check if swarm is now fully staffed
      const swarmFm = swarmData.data as unknown as import("@agent-workspace/core").SwarmFrontmatter;
      const summary = getSwarmStaffingSummary(swarmFm);
      if (summary.needed === 0 && swarmData.data.status === "recruiting") {
        swarmData.data.status = "active";
      }

      const output = matter.stringify(swarmData.content, swarmData.data);
      await writeFile(filePath, output, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `Assigned ${agentSlug} to role "${roleName}" in swarm "${slug}". Status: ${swarmData.data.status}`,
          },
        ],
      };
    }
  );

  // --- Tool: awp_swarm_update ---
  server.registerTool(
    "awp_swarm_update",
    {
      title: "Update Swarm",
      description: "Update swarm status.",
      inputSchema: {
        slug: z.string().describe("Swarm slug"),
        status: z
          .string()
          .optional()
          .describe("New status (recruiting, active, completed, disbanded)"),
      },
    },
    async ({ slug, status: newStatus }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, SWARMS_DIR, `${slug}.md`);

      let swarmData: { data: Record<string, unknown>; content: string };
      try {
        const raw = await readFile(filePath, "utf-8");
        swarmData = matter(raw);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Swarm "${slug}" not found.` }],
          isError: true,
        };
      }

      const changes: string[] = [];

      if (newStatus) {
        const validStatuses = ["recruiting", "active", "completed", "disbanded"];
        if (!validStatuses.includes(newStatus)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid status. Use: ${validStatuses.join(", ")}`,
              },
            ],
            isError: true,
          };
        }
        swarmData.data.status = newStatus;
        changes.push(`status → ${newStatus}`);
      }

      if (changes.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No changes specified." }],
        };
      }

      const output = matter.stringify(swarmData.content, swarmData.data);
      await writeFile(filePath, output, "utf-8");

      return {
        content: [
          { type: "text" as const, text: `Updated swarm "${slug}": ${changes.join(", ")}` },
        ],
      };
    }
  );

  // --- Tool: awp_swarm_role_add ---
  server.registerTool(
    "awp_swarm_role_add",
    {
      title: "Add Role to Swarm",
      description: "Add a new role to a swarm with optional reputation requirements.",
      inputSchema: {
        slug: z.string().describe("Swarm slug"),
        roleName: z.string().describe("Role name (e.g., 'researcher')"),
        count: z.number().optional().describe("Number of agents needed (default: 1)"),
        minReputation: z
          .record(z.string(), z.number())
          .optional()
          .describe("Map of dimension/domain to minimum score"),
      },
    },
    async ({ slug, roleName, count, minReputation }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, SWARMS_DIR, `${slug}.md`);

      let swarmData: { data: Record<string, unknown>; content: string };
      try {
        const raw = await readFile(filePath, "utf-8");
        swarmData = matter(raw);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Swarm "${slug}" not found.` }],
          isError: true,
        };
      }

      const roles = (swarmData.data.roles as SwarmRole[]) || [];

      if (roles.some((r: SwarmRole) => r.name === roleName)) {
        return {
          content: [{ type: "text" as const, text: `Role "${roleName}" already exists in swarm.` }],
          isError: true,
        };
      }

      const newRole: SwarmRole = {
        name: roleName,
        count: count || 1,
        assigned: [],
      };

      if (minReputation && Object.keys(minReputation).length > 0) {
        newRole.minReputation = minReputation;
      }

      roles.push(newRole);
      swarmData.data.roles = roles;

      const output = matter.stringify(swarmData.content, swarmData.data);
      await writeFile(filePath, output, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `Added role "${roleName}" (count: ${newRole.count}) to swarm "${slug}"`,
          },
        ],
      };
    }
  );
}
