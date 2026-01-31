import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { getWorkspaceRoot } from "@agent-workspace/utils";

/**
 * Register identity-related tools: read_identity, read_soul, read_user
 */
export function registerIdentityTools(server: McpServer): void {
  // --- Tool: awp_read_identity ---
  server.registerTool(
    "awp_read_identity",
    {
      title: "Read Agent Identity",
      description:
        "Read this agent's identity (name, creature, capabilities, DID) from the AWP workspace",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const path = join(root, "IDENTITY.md");
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
          content: [{ type: "text" as const, text: "Error: IDENTITY.md not found" }],
          isError: true,
        };
      }
    }
  );

  // --- Tool: awp_read_soul ---
  server.registerTool(
    "awp_read_soul",
    {
      title: "Read Agent Soul",
      description:
        "Read this agent's values, boundaries, and governance rules from the AWP workspace",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const path = join(root, "SOUL.md");
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
          content: [{ type: "text" as const, text: "Error: SOUL.md not found" }],
          isError: true,
        };
      }
    }
  );

  // --- Tool: awp_read_user ---
  server.registerTool(
    "awp_read_user",
    {
      title: "Read Human Profile",
      description: "Read the human user's profile from the AWP workspace",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const path = join(root, "USER.md");
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
          content: [{ type: "text" as const, text: "Error: USER.md not found" }],
          isError: true,
        };
      }
    }
  );
}
