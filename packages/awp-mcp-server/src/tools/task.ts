import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as z from "zod";
import { AWP_VERSION, CDP_VERSION, PROJECTS_DIR } from "@agent-workspace/core";
import {
  getWorkspaceRoot,
  getAgentDid,
  analyzeGraph,
  getTaskSlug,
  type TaskNode,
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
 * Register task-related tools: create, update, list
 */
export function registerTaskTools(server: McpServer): void {
  // --- Tool: awp_task_create ---
  server.registerTool(
    "awp_task_create",
    {
      title: "Create Task",
      description: "Create a new task within a project.",
      inputSchema: {
        projectSlug: z.string().describe("Project slug"),
        taskSlug: z.string().describe("Task slug"),
        title: z.string().optional().describe("Task title"),
        assignee: z.string().optional().describe("Assignee agent DID"),
        assigneeSlug: z.string().optional().describe("Assignee reputation profile slug"),
        priority: z.string().optional().describe("Priority (low, medium, high, critical)"),
        deadline: z.string().optional().describe("Deadline (ISO 8601 or YYYY-MM-DD)"),
        blockedBy: z.array(z.string()).optional().describe("Task IDs that block this task"),
        outputArtifact: z.string().optional().describe("Output artifact slug"),
        contractSlug: z.string().optional().describe("Associated contract slug"),
        tags: z.array(z.string()).optional().describe("Tags"),
      },
    },
    async ({
      projectSlug,
      taskSlug,
      title,
      assignee,
      assigneeSlug,
      priority,
      deadline,
      blockedBy,
      outputArtifact,
      contractSlug,
      tags,
    }) => {
      const root = getWorkspaceRoot();

      // Check project exists
      const projPath = join(root, PROJECTS_DIR, `${projectSlug}.md`);
      let projData: { data: Record<string, unknown>; content: string };
      try {
        const raw = await readFile(projPath, "utf-8");
        projData = matter(raw);
      } catch {
        return {
          content: [{ type: "text" as const, text: `Project "${projectSlug}" not found.` }],
          isError: true,
        };
      }

      const taskDir = join(root, PROJECTS_DIR, projectSlug, "tasks");
      await mkdir(taskDir, { recursive: true });

      const taskPath = join(taskDir, `${taskSlug}.md`);
      if (await fileExists(taskPath)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Task "${taskSlug}" already exists in project "${projectSlug}".`,
            },
          ],
          isError: true,
        };
      }

      const did = await getAgentDid(root);
      const now = new Date().toISOString();
      const taskTitle =
        title ||
        taskSlug
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      const data: Record<string, unknown> = {
        awp: AWP_VERSION,
        cdp: CDP_VERSION,
        type: "task",
        id: `task:${projectSlug}/${taskSlug}`,
        projectId: `project:${projectSlug}`,
        title: taskTitle,
        status: "pending",
        priority: priority || "medium",
        created: now,
        blockedBy: blockedBy || [],
        blocks: [],
        lastModified: now,
        modifiedBy: did,
      };
      if (assignee) data.assignee = assignee;
      if (assigneeSlug) data.assigneeSlug = assigneeSlug;
      if (deadline) data.deadline = deadline;
      if (outputArtifact) data.outputArtifact = outputArtifact;
      if (contractSlug) data.contractSlug = contractSlug;
      if (tags?.length) data.tags = tags;

      const body = `\n# ${taskTitle}\n\n`;
      const output = matter.stringify(body, data);
      await writeFile(taskPath, output, "utf-8");

      // Update project counts
      projData.data.taskCount = ((projData.data.taskCount as number) || 0) + 1;
      const projOutput = matter.stringify(projData.content, projData.data);
      await writeFile(projPath, projOutput, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `Created task "${taskSlug}" in project "${projectSlug}" (status: pending)`,
          },
        ],
      };
    }
  );

  // --- Tool: awp_task_update ---
  server.registerTool(
    "awp_task_update",
    {
      title: "Update Task",
      description: "Update a task's status, assignee, or other fields.",
      inputSchema: {
        projectSlug: z.string().describe("Project slug"),
        taskSlug: z.string().describe("Task slug"),
        status: z
          .string()
          .optional()
          .describe("New status (pending, in-progress, blocked, review, completed, cancelled)"),
        assignee: z.string().optional().describe("New assignee DID"),
        assigneeSlug: z.string().optional().describe("New assignee reputation slug"),
      },
    },
    async ({ projectSlug, taskSlug, status: newStatus, assignee, assigneeSlug }) => {
      const root = getWorkspaceRoot();
      const taskPath = join(root, PROJECTS_DIR, projectSlug, "tasks", `${taskSlug}.md`);

      let taskData: { data: Record<string, unknown>; content: string };
      try {
        const raw = await readFile(taskPath, "utf-8");
        taskData = matter(raw);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: `Task "${taskSlug}" not found in project "${projectSlug}".`,
            },
          ],
          isError: true,
        };
      }

      const did = await getAgentDid(root);
      const now = new Date().toISOString();
      const changes: string[] = [];

      if (newStatus) {
        taskData.data.status = newStatus;
        changes.push(`status → ${newStatus}`);
      }
      if (assignee) {
        taskData.data.assignee = assignee;
        changes.push(`assignee → ${assignee}`);
      }
      if (assigneeSlug) {
        taskData.data.assigneeSlug = assigneeSlug;
        changes.push(`assigneeSlug → ${assigneeSlug}`);
      }

      taskData.data.lastModified = now;
      taskData.data.modifiedBy = did;

      const output = matter.stringify(taskData.content, taskData.data);
      await writeFile(taskPath, output, "utf-8");

      // Update project counts if status changed
      if (newStatus) {
        const projPath = join(root, PROJECTS_DIR, `${projectSlug}.md`);
        try {
          const projRaw = await readFile(projPath, "utf-8");
          const projData = matter(projRaw);

          // Recount completed tasks
          const taskDir = join(root, PROJECTS_DIR, projectSlug, "tasks");
          let taskCount = 0;
          let completedCount = 0;
          try {
            const taskFiles = await readdir(taskDir);
            for (const tf of taskFiles.filter((t: string) => t.endsWith(".md"))) {
              try {
                const tRaw = await readFile(join(taskDir, tf), "utf-8");
                const { data: tData } = matter(tRaw);
                if (tData.type === "task") {
                  taskCount++;
                  if (tData.status === "completed") completedCount++;
                }
              } catch {
                /* skip */
              }
            }
          } catch {
            /* no tasks */
          }

          projData.data.taskCount = taskCount;
          projData.data.completedCount = completedCount;
          const projOutput = matter.stringify(projData.content, projData.data);
          await writeFile(projPath, projOutput, "utf-8");
        } catch {
          /* project not found */
        }
      }

      return {
        content: [
          { type: "text" as const, text: `Updated task "${taskSlug}": ${changes.join(", ")}` },
        ],
      };
    }
  );

  // --- Tool: awp_task_list ---
  server.registerTool(
    "awp_task_list",
    {
      title: "List Tasks",
      description: "List all tasks for a project with optional status and assignee filters.",
      inputSchema: {
        projectSlug: z.string().describe("Project slug"),
        status: z.string().optional().describe("Filter by status"),
        assigneeSlug: z.string().optional().describe("Filter by assignee slug"),
      },
    },
    async ({ projectSlug, status: statusFilter, assigneeSlug }) => {
      const root = getWorkspaceRoot();
      const taskDir = join(root, PROJECTS_DIR, projectSlug, "tasks");

      let files: string[];
      try {
        files = await readdir(taskDir);
      } catch {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ tasks: [] }, null, 2) }],
        };
      }

      const tasks: Record<string, unknown>[] = [];
      for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
        try {
          const raw = await readFile(join(taskDir, f), "utf-8");
          const { data } = matter(raw);
          if (data.type !== "task") continue;
          if (statusFilter && data.status !== statusFilter) continue;
          if (assigneeSlug && data.assigneeSlug !== assigneeSlug) continue;
          const blockedBy = data.blockedBy as string[] | undefined;
          const blocks = data.blocks as string[] | undefined;
          tasks.push({
            slug: f.replace(/\.md$/, ""),
            title: data.title,
            status: data.status,
            assigneeSlug: data.assigneeSlug,
            priority: data.priority,
            deadline: data.deadline,
            blockedBy: blockedBy || [],
            blocks: blocks || [],
          });
        } catch {
          /* skip */
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ tasks }, null, 2) }],
      };
    }
  );

  // --- Tool: awp_task_graph ---
  server.registerTool(
    "awp_task_graph",
    {
      title: "Analyze Task Dependencies",
      description:
        "Analyze task dependency graph: topological order, cycles, critical path, blocked tasks",
      inputSchema: {
        projectSlug: z.string().describe("Project slug"),
      },
    },
    async ({ projectSlug }) => {
      const root = getWorkspaceRoot();
      const taskDir = join(root, PROJECTS_DIR, projectSlug, "tasks");

      // Load all tasks
      let files: string[];
      try {
        files = await readdir(taskDir);
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  error: `No tasks found for project "${projectSlug}"`,
                  isValid: true,
                  sorted: [],
                  cycles: [],
                  criticalPath: [],
                  blocked: {},
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const taskNodes: TaskNode[] = [];
      for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
        try {
          const raw = await readFile(join(taskDir, f), "utf-8");
          const { data } = matter(raw);
          if (data.type !== "task") continue;
          const blockedBy = data.blockedBy as string[] | undefined;
          const blocks = data.blocks as string[] | undefined;
          taskNodes.push({
            id: data.id as string,
            blockedBy: blockedBy || [],
            blocks: blocks || [],
            status: data.status as string,
          });
        } catch {
          /* skip */
        }
      }

      // Run graph analysis
      const analysis = analyzeGraph(taskNodes);

      // Format output
      const result = {
        projectSlug,
        taskCount: taskNodes.length,
        isValid: analysis.isValid,
        sorted: analysis.sorted?.map((id) => ({
          id,
          slug: getTaskSlug(id),
        })),
        cycles: analysis.cycles.map((cycle) => cycle.map((id) => getTaskSlug(id))),
        criticalPath: analysis.criticalPath.map((id) => ({
          id,
          slug: getTaskSlug(id),
        })),
        blocked: Object.fromEntries(
          Array.from(analysis.blocked.entries()).map(([taskId, blockers]) => [
            getTaskSlug(taskId),
            blockers.map((b) => getTaskSlug(b)),
          ])
        ),
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
