#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { AWP_VERSION, SMP_VERSION, MEMORY_DIR, ARTIFACTS_DIR } from "@agent-workspace/core";

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

/**
 * Get agent DID from workspace manifest, or "anonymous"
 */
async function getAgentDid(root: string): Promise<string> {
  try {
    const raw = await readFile(join(root, ".awp", "workspace.json"), "utf-8");
    const manifest = JSON.parse(raw);
    return manifest.agent?.did || "anonymous";
  } catch {
    return "anonymous";
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

// --- Tool: awp_artifact_read ---
server.registerTool(
  "awp_artifact_read",
  {
    title: "Read Knowledge Artifact",
    description:
      "Read a knowledge artifact by slug. Returns metadata (title, version, confidence, provenance) and body content.",
    inputSchema: {
      slug: z.string().describe("Artifact slug (e.g., 'llm-context-research')"),
    },
  },
  async ({ slug }) => {
    const root = getWorkspaceRoot();
    const path = join(root, ARTIFACTS_DIR, `${slug}.md`);
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
          { type: "text" as const, text: `Artifact "${slug}" not found.` },
        ],
        isError: true,
      };
    }
  }
);

// --- Tool: awp_artifact_write ---
server.registerTool(
  "awp_artifact_write",
  {
    title: "Write Knowledge Artifact",
    description:
      "Create or update a knowledge artifact. If the artifact exists, increments version and appends provenance. If new, creates it with version 1.",
    inputSchema: {
      slug: z.string().describe("Artifact slug (lowercase, hyphens only)"),
      title: z.string().optional().describe("Title (required for new artifacts)"),
      content: z.string().describe("Markdown body content"),
      tags: z.array(z.string()).optional().describe("Categorization tags"),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Confidence score (0.0-1.0)"),
      message: z.string().optional().describe("Commit message for provenance"),
    },
  },
  async ({ slug, title, content: bodyContent, tags, confidence, message }) => {
    const root = getWorkspaceRoot();
    const artifactsDir = join(root, ARTIFACTS_DIR);
    await mkdir(artifactsDir, { recursive: true });

    const filePath = join(artifactsDir, `${slug}.md`);
    const did = await getAgentDid(root);
    const now = new Date().toISOString();

    let fileData: { data: any; content: string };
    let version: number;
    let isNew = false;

    try {
      const raw = await readFile(filePath, "utf-8");
      fileData = matter(raw);

      // Update existing
      fileData.data.version = (fileData.data.version || 1) + 1;
      version = fileData.data.version;
      fileData.data.lastModified = now;
      fileData.data.modifiedBy = did;
      fileData.content = `\n${bodyContent}\n`;

      if (confidence !== undefined) fileData.data.confidence = confidence;
      if (tags) fileData.data.tags = tags;
      if (title) fileData.data.title = title;

      // Add author if new
      if (!fileData.data.authors?.includes(did)) {
        if (!fileData.data.authors) fileData.data.authors = [];
        fileData.data.authors.push(did);
      }

      // Append provenance
      if (!fileData.data.provenance) fileData.data.provenance = [];
      fileData.data.provenance.push({
        agent: did,
        action: "updated",
        timestamp: now,
        message,
        confidence,
      });
    } catch {
      // Create new
      isNew = true;
      version = 1;
      const artifactTitle =
        title ||
        slug
          .split("-")
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");

      fileData = {
        data: {
          awp: AWP_VERSION,
          smp: SMP_VERSION,
          type: "knowledge-artifact",
          id: `artifact:${slug}`,
          title: artifactTitle,
          authors: [did],
          version: 1,
          confidence,
          tags: tags?.length ? tags : undefined,
          created: now,
          lastModified: now,
          modifiedBy: did,
          provenance: [
            {
              agent: did,
              action: "created",
              timestamp: now,
              message,
            },
          ],
        },
        content: `\n${bodyContent}\n`,
      };
    }

    const output = matter.stringify(fileData.content, fileData.data);
    await writeFile(filePath, output, "utf-8");

    return {
      content: [
        {
          type: "text" as const,
          text: `${isNew ? "Created" : "Updated"} artifacts/${slug}.md (version ${version})`,
        },
      ],
    };
  }
);

// --- Tool: awp_artifact_list ---
server.registerTool(
  "awp_artifact_list",
  {
    title: "List Knowledge Artifacts",
    description:
      "List all knowledge artifacts in the workspace with metadata",
    inputSchema: {
      tag: z.string().optional().describe("Filter by tag"),
    },
  },
  async ({ tag }) => {
    const root = getWorkspaceRoot();
    const artifactsDir = join(root, ARTIFACTS_DIR);

    let files: string[];
    try {
      files = await readdir(artifactsDir);
    } catch {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ artifacts: [] }, null, 2) },
        ],
      };
    }

    const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
    const artifacts: any[] = [];

    for (const f of mdFiles) {
      try {
        const raw = await readFile(join(artifactsDir, f), "utf-8");
        const { data } = matter(raw);
        if (data.type !== "knowledge-artifact") continue;

        if (tag && !data.tags?.some((t: string) => t.toLowerCase() === tag.toLowerCase())) {
          continue;
        }

        artifacts.push({
          slug: f.replace(/\.md$/, ""),
          title: data.title,
          version: data.version,
          confidence: data.confidence,
          tags: data.tags,
          authors: data.authors,
          lastModified: data.lastModified,
        });
      } catch {
        // Skip unparseable
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ artifacts }, null, 2),
        },
      ],
    };
  }
);

// --- Tool: awp_artifact_search ---
server.registerTool(
  "awp_artifact_search",
  {
    title: "Search Knowledge Artifacts",
    description: "Search artifacts by title, tags, or body content",
    inputSchema: {
      query: z.string().describe("Search query"),
    },
  },
  async ({ query }) => {
    const root = getWorkspaceRoot();
    const artifactsDir = join(root, ARTIFACTS_DIR);
    const queryLower = query.toLowerCase();

    let files: string[];
    try {
      files = await readdir(artifactsDir);
    } catch {
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ results: [] }, null, 2) },
        ],
      };
    }

    const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
    const results: any[] = [];

    for (const f of mdFiles) {
      try {
        const raw = await readFile(join(artifactsDir, f), "utf-8");
        const { data, content } = matter(raw);
        if (data.type !== "knowledge-artifact") continue;

        const titleMatch = data.title?.toLowerCase().includes(queryLower);
        const tagMatch = data.tags?.some((t: string) =>
          t.toLowerCase().includes(queryLower)
        );
        const bodyMatch = content.toLowerCase().includes(queryLower);

        if (titleMatch || tagMatch || bodyMatch) {
          results.push({
            slug: f.replace(/\.md$/, ""),
            title: data.title,
            version: data.version,
            confidence: data.confidence,
            tags: data.tags,
            matchedIn: [
              titleMatch && "title",
              tagMatch && "tags",
              bodyMatch && "body",
            ].filter(Boolean),
          });
        }
      } catch {
        // Skip
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ results }, null, 2),
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
      "Get AWP workspace health status — manifest info, file presence, memory stats, artifact count",
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

    // Artifact stats
    try {
      const artDir = join(root, ARTIFACTS_DIR);
      const files = await readdir(artDir);
      const mdFiles = files.filter((f) => f.endsWith(".md"));
      status.artifacts = { count: mdFiles.length };
    } catch {
      status.artifacts = { count: 0 };
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
