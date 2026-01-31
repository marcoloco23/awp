import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as z from "zod";
import { AWP_VERSION, MEMORY_DIR } from "@agent-workspace/core";
import { getWorkspaceRoot } from "@agent-workspace/utils";

/**
 * Register memory-related tools: read_memory, write_memory
 */
export function registerMemoryTools(server: McpServer): void {
  // --- Tool: awp_read_memory ---
  server.registerTool(
    "awp_read_memory",
    {
      title: "Read Memory",
      description:
        "Read memory entries. Specify a date (YYYY-MM-DD) for daily logs, or 'longterm' for MEMORY.md, or 'recent' for the last 3 days",
      inputSchema: {
        target: z
          .string()
          .describe("Which memory to read: a date like '2026-01-30', 'longterm', or 'recent'"),
      },
    },
    async ({ target }) => {
      const root = getWorkspaceRoot();

      if (target === "longterm") {
        const path = join(root, "MEMORY.md");
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
            content: [{ type: "text" as const, text: "No long-term memory file exists yet." }],
          };
        }
      }

      if (target === "recent") {
        const memDir = join(root, MEMORY_DIR);
        try {
          const files = await readdir(memDir);
          const mdFiles = files
            .filter((f) => f.endsWith(".md"))
            .sort()
            .reverse()
            .slice(0, 3);

          const results: string[] = [];
          for (const f of mdFiles) {
            const raw = await readFile(join(memDir, f), "utf-8");
            const { data, content } = matter(raw);
            results.push(`--- ${f} ---\n${JSON.stringify(data, null, 2)}\n${content.trim()}`);
          }

          return {
            content: [
              {
                type: "text" as const,
                text: results.length ? results.join("\n\n") : "No recent memory entries.",
              },
            ],
          };
        } catch {
          return {
            content: [{ type: "text" as const, text: "No memory directory found." }],
          };
        }
      }

      // Specific date
      const path = join(root, MEMORY_DIR, `${target}.md`);
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
          content: [{ type: "text" as const, text: `No memory entry for ${target}.` }],
        };
      }
    }
  );

  // --- Tool: awp_write_memory ---
  server.registerTool(
    "awp_write_memory",
    {
      title: "Write Memory",
      description: "Append an entry to today's memory log in the AWP workspace",
      inputSchema: {
        content: z.string().describe("The memory entry to log"),
        tags: z.array(z.string()).optional().describe("Optional categorization tags"),
      },
    },
    async ({ content: entryContent, tags }) => {
      const root = getWorkspaceRoot();
      const memDir = join(root, MEMORY_DIR);
      await mkdir(memDir, { recursive: true });

      const date = new Date().toISOString().split("T")[0];
      const time = new Date().toTimeString().slice(0, 5);
      const filePath = join(memDir, `${date}.md`);

      const entry = {
        time,
        content: entryContent,
        tags: tags?.length ? tags : undefined,
      };

      let fileData: { data: Record<string, unknown>; content: string };

      try {
        const raw = await readFile(filePath, "utf-8");
        fileData = matter(raw);
        if (!fileData.data.entries) fileData.data.entries = [];
        (fileData.data.entries as unknown[]).push(entry);
      } catch {
        fileData = {
          data: {
            awp: AWP_VERSION,
            type: "memory-daily",
            date,
            entries: [entry],
          },
          content: `\n# ${date}\n\n`,
        };
      }

      const tagStr = tags?.length ? ` [${tags.join(", ")}]` : "";
      fileData.content += `- **${time}** — ${entryContent}${tagStr}\n`;

      const output = matter.stringify(fileData.content, fileData.data);
      await writeFile(filePath, output, "utf-8");

      return {
        content: [
          {
            type: "text" as const,
            text: `Logged to memory/${date}.md at ${time}`,
          },
        ],
      };
    }
  );
}
