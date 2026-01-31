import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { getWorkspaceRoot } from "@agent-workspace/utils";

/**
 * Register config-related tools: read_heartbeat, read_tools, read_agents
 */
export function registerConfigTools(server: McpServer): void {
  // --- Tool: awp_read_heartbeat ---
  server.registerTool(
    "awp_read_heartbeat",
    {
      title: "Read Heartbeat Config",
      description: "Read the agent's heartbeat configuration (HEARTBEAT.md)",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const path = join(root, "HEARTBEAT.md");
      try {
        const raw = await readFile(path, "utf-8");
        const { data, content } = matter(raw);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ frontmatter: data, body: content.trim() }, null, 2),
            },
          ],
        };
      } catch {
        return {
          content: [{ type: "text" as const, text: "HEARTBEAT.md not found" }],
          isError: true,
        };
      }
    }
  );

  // --- Tool: awp_read_tools ---
  server.registerTool(
    "awp_read_tools",
    {
      title: "Read Tools Config",
      description: "Read the agent's tools configuration (TOOLS.md)",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const path = join(root, "TOOLS.md");
      try {
        const raw = await readFile(path, "utf-8");
        const { data, content } = matter(raw);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ frontmatter: data, body: content.trim() }, null, 2),
            },
          ],
        };
      } catch {
        return {
          content: [{ type: "text" as const, text: "TOOLS.md not found" }],
          isError: true,
        };
      }
    }
  );

  // --- Tool: awp_read_agents ---
  server.registerTool(
    "awp_read_agents",
    {
      title: "Read Operations/Agents Config",
      description: "Read the agent's operations configuration (AGENTS.md)",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const path = join(root, "AGENTS.md");
      try {
        const raw = await readFile(path, "utf-8");
        const { data, content } = matter(raw);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ frontmatter: data, body: content.trim() }, null, 2),
            },
          ],
        };
      } catch {
        return {
          content: [{ type: "text" as const, text: "AGENTS.md not found" }],
          isError: true,
        };
      }
    }
  );
}
