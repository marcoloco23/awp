import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as z from "zod";
import { AWP_VERSION, CDP_VERSION, PROJECTS_DIR } from "@agent-workspace/core";
import { getWorkspaceRoot, getAgentDid } from "@agent-workspace/utils";

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
 * Register project-related tools: create, list, status
 */
export function registerProjectTools(server: McpServer): void {
  // --- Tool: awp_project_create ---
  server.registerTool(
    "awp_project_create",
    {
      title: "Create Project",
      description:
        "Create a new coordination project with member roles and optional reputation gates.",
      inputSchema: {
        slug: z.string().describe("Project slug (e.g., 'q3-product-launch')"),
        title: z.string().optional().describe("Project title"),
        deadline: z.string().optional().describe("Deadline (ISO 8601 or YYYY-MM-DD)"),
        tags: z.array(z.string()).optional().describe("Classification tags"),
      },
    },
    async ({ slug, title, deadline, tags }) => {
      const root = getWorkspaceRoot();
      const projDir = join(root, PROJECTS_DIR);
      await mkdir(projDir, { recursive: true });

      const filePath = join(projDir, `${slug}.md`);
      if (await fileExists(filePath)) {
        return {
          content: [{ type: "text" as const, text: `Project "${slug}" already exists.` }],
          isError: true,
        };
      }

      const did = await getAgentDid(root);
      const now = new Date().toISOString();
      const projectTitle =
        title ||
        slug
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      const data: Record<string, unknown> = {
        awp: AWP_VERSION,
        cdp: CDP_VERSION,
        type: "project",
        id: `project:${slug}`,
        title: projectTitle,
        status: "active",
        owner: did,
        created: now,
        members: [{ did, role: "lead", slug: "self" }],
        taskCount: 0,
        completedCount: 0,
      };
      if (deadline) data.deadline = deadline;
      if (tags?.length) data.tags = tags;

      const body = `\n# ${projectTitle}\n\n`;
      const output = matter.stringify(body, data);
      await writeFile(filePath, output, "utf-8");

      return {
        content: [{ type: "text" as const, text: `Created projects/${slug}.md (status: active)` }],
      };
    }
  );

  // --- Tool: awp_project_list ---
  server.registerTool(
    "awp_project_list",
    {
      title: "List Projects",
      description: "List all projects in the workspace with status and task progress.",
      inputSchema: {
        status: z
          .string()
          .optional()
          .describe("Filter by status (draft, active, paused, completed, archived)"),
      },
    },
    async ({ status: statusFilter }) => {
      const root = getWorkspaceRoot();
      const projDir = join(root, PROJECTS_DIR);

      let files: string[];
      try {
        files = await readdir(projDir);
      } catch {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ projects: [] }, null, 2) }],
        };
      }

      const projects: Record<string, unknown>[] = [];
      for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
        try {
          const raw = await readFile(join(projDir, f), "utf-8");
          const { data } = matter(raw);
          if (data.type !== "project") continue;
          if (statusFilter && data.status !== statusFilter) continue;
          const members = data.members as unknown[] | undefined;
          projects.push({
            slug: f.replace(/\.md$/, ""),
            title: data.title,
            status: data.status,
            taskCount: data.taskCount || 0,
            completedCount: data.completedCount || 0,
            deadline: data.deadline,
            owner: data.owner,
            memberCount: members?.length || 0,
          });
        } catch {
          /* skip */
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ projects }, null, 2) }],
      };
    }
  );

  // --- Tool: awp_project_status ---
  server.registerTool(
    "awp_project_status",
    {
      title: "Project Status",
      description: "Get detailed project status including members, tasks, and progress.",
      inputSchema: {
        slug: z.string().describe("Project slug"),
      },
    },
    async ({ slug }) => {
      const root = getWorkspaceRoot();
      const filePath = join(root, PROJECTS_DIR, `${slug}.md`);

      try {
        const raw = await readFile(filePath, "utf-8");
        const { data, content } = matter(raw);

        // Load tasks
        const tasks: Record<string, unknown>[] = [];
        try {
          const taskDir = join(root, PROJECTS_DIR, slug, "tasks");
          const taskFiles = await readdir(taskDir);
          for (const tf of taskFiles.filter((t: string) => t.endsWith(".md")).sort()) {
            try {
              const tRaw = await readFile(join(taskDir, tf), "utf-8");
              const { data: tData } = matter(tRaw);
              const blockedBy = tData.blockedBy as string[] | undefined;
              tasks.push({
                slug: tf.replace(/\.md$/, ""),
                title: tData.title,
                status: tData.status,
                assigneeSlug: tData.assigneeSlug,
                priority: tData.priority,
                deadline: tData.deadline,
                blockedBy: blockedBy || [],
              });
            } catch {
              /* skip */
            }
          }
        } catch {
          /* no tasks */
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ frontmatter: data, body: content.trim(), tasks }, null, 2),
            },
          ],
        };
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${slug}" not found.` }],
          isError: true,
        };
      }
    }
  );
}
