#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { AWP_VERSION, MEMORY_DIR } from "@awp/core";

const server = new McpServer({
  name: "awp-workspace",
  version: AWP_VERSION,
});

/**
 * Resolve workspace root from the AWP_WORKSPACE env var or cwd
 */
function getWorkspaceRoot(): string {
  return process.env.AWP_WORKSPACE || process.cwd();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

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
        .describe(
          "Which memory to read: a date like '2026-01-30', 'longterm', or 'recent'"
        ),
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
              text: JSON.stringify(
                { frontmatter: data, body: content.trim() },
                null,
                2
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            { type: "text" as const, text: "No long-term memory file exists yet." },
          ],
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
          results.push(
            `--- ${f} ---\n${JSON.stringify(data, null, 2)}\n${content.trim()}`
          );
        }

        return {
          content: [
            {
              type: "text" as const,
              text: results.length
                ? results.join("\n\n")
                : "No recent memory entries.",
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
            text: JSON.stringify(
              { frontmatter: data, body: content.trim() },
              null,
              2
            ),
          },
        ],
      };
    } catch {
      return {
        content: [
          { type: "text" as const, text: `No memory entry for ${target}.` },
        ],
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
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional categorization tags"),
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

    let fileData: { data: any; content: string };

    try {
      const raw = await readFile(filePath, "utf-8");
      fileData = matter(raw);
      if (!fileData.data.entries) fileData.data.entries = [];
      fileData.data.entries.push(entry);
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

// --- Tool: awp_workspace_status ---
server.registerTool(
  "awp_workspace_status",
  {
    title: "Workspace Status",
    description:
      "Get AWP workspace health status — manifest info, file presence, memory stats",
    inputSchema: {},
  },
  async () => {
    const root = getWorkspaceRoot();
    const status: Record<string, any> = { root };

    // Manifest
    try {
      const manifestRaw = await readFile(
        join(root, ".awp", "workspace.json"),
        "utf-8"
      );
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
    for (const f of fileChecks) {
      status.files[f] = await fileExists(join(root, f));
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

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(status, null, 2) },
      ],
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
