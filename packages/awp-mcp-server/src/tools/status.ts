import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import {
  MEMORY_DIR,
  ARTIFACTS_DIR,
  REPUTATION_DIR,
  CONTRACTS_DIR,
  PROJECTS_DIR,
} from "@agent-workspace/core";
import { getWorkspaceRoot } from "@agent-workspace/utils";

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
 * Register status-related tools: workspace_status
 */
export function registerStatusTools(server: McpServer): void {
  // --- Tool: awp_workspace_status ---
  server.registerTool(
    "awp_workspace_status",
    {
      title: "Workspace Status",
      description:
        "Get AWP workspace health status — manifest, files, projects, tasks, reputation, contracts, artifacts, memory, health warnings",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const status: Record<string, unknown> = { root };

      // Manifest
      try {
        const manifestRaw = await readFile(join(root, ".awp", "workspace.json"), "utf-8");
        status.manifest = JSON.parse(manifestRaw);
      } catch {
        status.manifest = null;
        status.error = "No .awp/workspace.json found";
      }

      // File presence
      const fileChecks = [
        "IDENTITY.md",
        "SOUL.md",
        "AGENTS.md",
        "USER.md",
        "TOOLS.md",
        "HEARTBEAT.md",
        "MEMORY.md",
      ];
      status.files = {};
      const filesStatus = status.files as Record<string, boolean>;
      for (const f of fileChecks) {
        filesStatus[f] = await fileExists(join(root, f));
      }

      // Memory stats
      try {
        const memDir = join(root, MEMORY_DIR);
        const files = await readdir(memDir);
        const mdFiles = files.filter((f) => f.endsWith(".md"));
        status.memory = {
          logCount: mdFiles.length,
          latest: mdFiles.sort().reverse()[0] || null,
        };
      } catch {
        status.memory = { logCount: 0, latest: null };
      }

      // Artifact stats
      try {
        const artDir = join(root, ARTIFACTS_DIR);
        const files = await readdir(artDir);
        const mdFiles = files.filter((f) => f.endsWith(".md"));
        status.artifacts = { count: mdFiles.length };
      } catch {
        status.artifacts = { count: 0 };
      }

      // Reputation stats
      try {
        const repDir = join(root, REPUTATION_DIR);
        const files = await readdir(repDir);
        const mdFiles = files.filter((f) => f.endsWith(".md"));
        status.reputation = { count: mdFiles.length };
      } catch {
        status.reputation = { count: 0 };
      }

      // Contract stats
      try {
        const conDir = join(root, CONTRACTS_DIR);
        const files = await readdir(conDir);
        const mdFiles = files.filter((f) => f.endsWith(".md"));
        status.contracts = { count: mdFiles.length };
      } catch {
        status.contracts = { count: 0 };
      }

      // Project + task stats
      const projectsSummary: Record<string, unknown>[] = [];
      let totalTasks = 0;
      let activeTasks = 0;
      try {
        const projDir = join(root, PROJECTS_DIR);
        const projFiles = await readdir(projDir);
        const mdFiles = projFiles.filter((f) => f.endsWith(".md")).sort();

        for (const f of mdFiles) {
          try {
            const raw = await readFile(join(projDir, f), "utf-8");
            const { data } = matter(raw);
            if (data.type !== "project") continue;
            const slug = f.replace(/\.md$/, "");
            const projInfo: Record<string, unknown> = {
              slug,
              title: data.title,
              status: data.status,
              taskCount: data.taskCount || 0,
              completedCount: data.completedCount || 0,
            };
            if (data.deadline) projInfo.deadline = data.deadline;
            projectsSummary.push(projInfo);
            totalTasks += (data.taskCount as number) || 0;

            // Count active tasks
            try {
              const taskDir = join(projDir, slug, "tasks");
              const taskFiles = await readdir(taskDir);
              for (const tf of taskFiles.filter((t: string) => t.endsWith(".md"))) {
                try {
                  const tRaw = await readFile(join(taskDir, tf), "utf-8");
                  const { data: tData } = matter(tRaw);
                  if (
                    tData.status === "in-progress" ||
                    tData.status === "blocked" ||
                    tData.status === "review"
                  ) {
                    activeTasks++;
                  }
                } catch {
                  /* skip */
                }
              }
            } catch {
              /* no tasks dir */
            }
          } catch {
            /* skip */
          }
        }
      } catch {
        /* no projects dir */
      }

      status.projects = {
        count: projectsSummary.length,
        totalTasks,
        activeTasks,
        list: projectsSummary,
      };

      // Health warnings
      const warnings: string[] = [];
      const now = new Date();
      const MS_PER_DAY = 24 * 60 * 60 * 1000;

      // Check required files
      if (!filesStatus["IDENTITY.md"]) warnings.push("IDENTITY.md missing");
      if (!filesStatus["SOUL.md"]) warnings.push("SOUL.md missing");

      // Check contract deadlines
      try {
        const conDir = join(root, CONTRACTS_DIR);
        const conFiles = await readdir(conDir);
        for (const f of conFiles.filter((f) => f.endsWith(".md"))) {
          try {
            const raw = await readFile(join(conDir, f), "utf-8");
            const { data } = matter(raw);
            if (data.deadline && (data.status === "active" || data.status === "draft")) {
              if (new Date(data.deadline as string) < now) {
                warnings.push(`Contract "${f.replace(/\.md$/, "")}" is past deadline`);
              }
            }
          } catch {
            /* skip */
          }
        }
      } catch {
        /* no contracts */
      }

      // Check reputation decay
      try {
        const repDir = join(root, REPUTATION_DIR);
        const repFiles = await readdir(repDir);
        for (const f of repFiles.filter((f) => f.endsWith(".md"))) {
          try {
            const raw = await readFile(join(repDir, f), "utf-8");
            const { data } = matter(raw);
            if (data.lastUpdated) {
              const daysSince = Math.floor(
                (now.getTime() - new Date(data.lastUpdated as string).getTime()) / MS_PER_DAY
              );
              if (daysSince > 30) {
                warnings.push(
                  `${f.replace(/\.md$/, "")} reputation decaying (no signal in ${daysSince} days)`
                );
              }
            }
          } catch {
            /* skip */
          }
        }
      } catch {
        /* no reputation */
      }

      status.health = {
        warnings,
        ok: warnings.length === 0,
      };

      return {
        content: [{ type: "text" as const, text: JSON.stringify(status, null, 2) }],
      };
    }
  );
}
