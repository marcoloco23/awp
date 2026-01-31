#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { readFile, writeFile, readdir, mkdir, access, stat } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import matter from "gray-matter";
import {
  AWP_VERSION,
  SMP_VERSION,
  RDP_VERSION,
  CDP_VERSION,
  MEMORY_DIR,
  ARTIFACTS_DIR,
  REPUTATION_DIR,
  CONTRACTS_DIR,
  PROJECTS_DIR,
} from "@agent-workspace/core";

// =============================================================================
// Security Constants
// =============================================================================

/** Maximum file size allowed (1MB) */
const MAX_FILE_SIZE = 1024 * 1024;

/** Pattern for valid slugs */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

// =============================================================================
// Security Utilities
// =============================================================================

/**
 * Validate that a path is within the workspace root (prevents directory traversal).
 * Returns the normalized absolute path if valid, or throws an error.
 * @internal Available for future use in tool handlers
 */
export function _validatePath(root: string, targetPath: string): string {
  const normalized = resolve(root, targetPath);
  const rel = relative(root, normalized);

  // Prevent directory traversal
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }

  return normalized;
}

/**
 * Validate and sanitize a slug.
 * Slugs must be lowercase alphanumeric with hyphens, not starting with hyphen.
 * @internal Available for future use in tool handlers
 */
export function _validateSlug(slug: string): string {
  const trimmed = slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid slug: "${slug}". Must be lowercase alphanumeric with hyphens, not starting with hyphen.`
    );
  }
  // Additional safety: limit length
  if (trimmed.length > 100) {
    throw new Error(`Slug too long: max 100 characters`);
  }
  return trimmed;
}

/**
 * Read a file with size limit check.
 * @internal Available for future use in tool handlers
 */
export async function _safeReadFile(path: string): Promise<string> {
  const stats = await stat(path);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${stats.size} bytes (max: ${MAX_FILE_SIZE})`);
  }
  return readFile(path, "utf-8");
}

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
            text: JSON.stringify({ frontmatter: data, body: content.trim() }, null, 2),
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text" as const, text: `Artifact "${slug}" not found.` }],
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
      confidence: z.number().min(0).max(1).optional().describe("Confidence score (0.0-1.0)"),
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
    description: "List all knowledge artifacts in the workspace with metadata",
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
        content: [{ type: "text" as const, text: JSON.stringify({ artifacts: [] }, null, 2) }],
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
        content: [{ type: "text" as const, text: JSON.stringify({ results: [] }, null, 2) }],
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
        const tagMatch = data.tags?.some((t: string) => t.toLowerCase().includes(queryLower));
        const bodyMatch = content.toLowerCase().includes(queryLower);

        if (titleMatch || tagMatch || bodyMatch) {
          results.push({
            slug: f.replace(/\.md$/, ""),
            title: data.title,
            version: data.version,
            confidence: data.confidence,
            tags: data.tags,
            matchedIn: [titleMatch && "title", tagMatch && "tags", bodyMatch && "body"].filter(
              Boolean
            ),
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
      "Get AWP workspace health status — manifest, files, projects, tasks, reputation, contracts, artifacts, memory, health warnings",
    inputSchema: {},
  },
  async () => {
    const root = getWorkspaceRoot();
    const status: Record<string, any> = { root };

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
    const projectsSummary: any[] = [];
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
          const projInfo: any = {
            slug,
            title: data.title,
            status: data.status,
            taskCount: data.taskCount || 0,
            completedCount: data.completedCount || 0,
          };
          if (data.deadline) projInfo.deadline = data.deadline;
          projectsSummary.push(projInfo);
          totalTasks += data.taskCount || 0;

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
    if (!status.files["IDENTITY.md"]) warnings.push("IDENTITY.md missing");
    if (!status.files["SOUL.md"]) warnings.push("SOUL.md missing");

    // Check contract deadlines
    try {
      const conDir = join(root, CONTRACTS_DIR);
      const conFiles = await readdir(conDir);
      for (const f of conFiles.filter((f) => f.endsWith(".md"))) {
        try {
          const raw = await readFile(join(conDir, f), "utf-8");
          const { data } = matter(raw);
          if (data.deadline && (data.status === "active" || data.status === "draft")) {
            if (new Date(data.deadline) < now) {
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
              (now.getTime() - new Date(data.lastUpdated).getTime()) / MS_PER_DAY
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

// --- Tool: awp_reputation_query ---
server.registerTool(
  "awp_reputation_query",
  {
    title: "Query Reputation",
    description:
      "Query an agent's reputation profile. Returns multi-dimensional scores with decay applied. Omit slug to list all tracked agents.",
    inputSchema: {
      slug: z.string().optional().describe("Agent reputation slug (omit to list all)"),
      dimension: z.string().optional().describe("Filter by dimension"),
      domain: z.string().optional().describe("Filter by domain competence"),
    },
  },
  async ({ slug, dimension, domain }) => {
    const root = getWorkspaceRoot();

    if (!slug) {
      // List all profiles
      const repDir = join(root, REPUTATION_DIR);
      let files: string[];
      try {
        files = await readdir(repDir);
      } catch {
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ profiles: [] }, null, 2) }],
        };
      }
      const profiles: any[] = [];
      for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
        try {
          const raw = await readFile(join(repDir, f), "utf-8");
          const { data } = matter(raw);
          if (data.type !== "reputation-profile") continue;
          profiles.push({
            slug: f.replace(/\.md$/, ""),
            agentName: data.agentName,
            agentDid: data.agentDid,
            signalCount: data.signals?.length || 0,
            dimensions: Object.keys(data.dimensions || {}),
            domains: Object.keys(data.domainCompetence || {}),
          });
        } catch {
          /* skip */
        }
      }
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ profiles }, null, 2) }],
      };
    }

    // Read specific profile
    const path = join(root, REPUTATION_DIR, `${slug}.md`);
    try {
      const raw = await readFile(path, "utf-8");
      const { data, content } = matter(raw);

      // Apply decay to scores
      const now = new Date();
      const DECAY_RATE = 0.02;
      const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

      const applyDecay = (dim: any) => {
        if (!dim?.lastSignal) return dim;
        const months = (now.getTime() - new Date(dim.lastSignal).getTime()) / MS_PER_MONTH;
        if (months <= 0) return { ...dim };
        const factor = Math.exp(-DECAY_RATE * months);
        const decayed = 0.5 + (dim.score - 0.5) * factor;
        return { ...dim, decayedScore: Math.round(decayed * 1000) / 1000 };
      };

      const result: any = { ...data, body: content.trim() };

      // Apply decay to dimensions
      if (data.dimensions) {
        result.dimensions = {};
        for (const [name, dim] of Object.entries(data.dimensions as Record<string, any>)) {
          if (dimension && name !== dimension) continue;
          result.dimensions[name] = applyDecay(dim);
        }
      }
      if (data.domainCompetence) {
        result.domainCompetence = {};
        for (const [name, dim] of Object.entries(data.domainCompetence as Record<string, any>)) {
          if (domain && name !== domain) continue;
          result.domainCompetence[name] = applyDecay(dim);
        }
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch {
      return {
        content: [{ type: "text" as const, text: `Reputation profile "${slug}" not found.` }],
        isError: true,
      };
    }
  }
);

// --- Tool: awp_reputation_signal ---
server.registerTool(
  "awp_reputation_signal",
  {
    title: "Log Reputation Signal",
    description:
      "Log a reputation signal for an agent. Creates the profile if it doesn't exist (requires agentDid and agentName for new profiles).",
    inputSchema: {
      slug: z.string().describe("Agent reputation slug"),
      dimension: z
        .string()
        .describe("Dimension (reliability, epistemic-hygiene, coordination, domain-competence)"),
      score: z.number().min(0).max(1).describe("Score (0.0-1.0)"),
      domain: z.string().optional().describe("Domain (required for domain-competence)"),
      evidence: z.string().optional().describe("Evidence reference"),
      message: z.string().optional().describe("Human-readable note"),
      agentDid: z.string().optional().describe("Agent DID (required for new profiles)"),
      agentName: z.string().optional().describe("Agent name (required for new profiles)"),
    },
  },
  async ({
    slug,
    dimension: dim,
    score,
    domain,
    evidence,
    message,
    agentDid: newDid,
    agentName: newName,
  }) => {
    const root = getWorkspaceRoot();
    const repDir = join(root, REPUTATION_DIR);
    await mkdir(repDir, { recursive: true });
    const filePath = join(repDir, `${slug}.md`);
    const sourceDid = await getAgentDid(root);
    const now = new Date();
    const timestamp = now.toISOString();
    const ALPHA = 0.15;

    const signal: any = { source: sourceDid, dimension: dim, score, timestamp };
    if (domain) signal.domain = domain;
    if (evidence) signal.evidence = evidence;
    if (message) signal.message = message;

    const updateDim = (existing: any, signalScore: number) => {
      if (!existing) {
        return {
          score: signalScore,
          confidence: Math.round((1 - 1 / (1 + 1 * 0.1)) * 100) / 100,
          sampleSize: 1,
          lastSignal: timestamp,
        };
      }
      // Apply decay then EWMA
      const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
      const months = (now.getTime() - new Date(existing.lastSignal).getTime()) / MS_PER_MONTH;
      const decayFactor = months > 0 ? Math.exp(-0.02 * months) : 1;
      const decayed = 0.5 + (existing.score - 0.5) * decayFactor;
      const newScore = ALPHA * signalScore + (1 - ALPHA) * decayed;
      const newSampleSize = existing.sampleSize + 1;
      return {
        score: Math.round(newScore * 1000) / 1000,
        confidence: Math.round((1 - 1 / (1 + newSampleSize * 0.1)) * 100) / 100,
        sampleSize: newSampleSize,
        lastSignal: timestamp,
      };
    };

    let isNew = false;
    let fileData: { data: any; content: string };

    try {
      const raw = await readFile(filePath, "utf-8");
      fileData = matter(raw);
    } catch {
      // New profile
      if (!newDid || !newName) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: agentDid and agentName required for new profiles.",
            },
          ],
          isError: true,
        };
      }
      isNew = true;
      fileData = {
        data: {
          awp: AWP_VERSION,
          rdp: RDP_VERSION,
          type: "reputation-profile",
          id: `reputation:${slug}`,
          agentDid: newDid,
          agentName: newName,
          lastUpdated: timestamp,
          dimensions: {},
          domainCompetence: {},
          signals: [],
        },
        content: `\n# ${newName} — Reputation Profile\n\nTracked since ${timestamp.split("T")[0]}.\n`,
      };
    }

    fileData.data.lastUpdated = timestamp;
    fileData.data.signals.push(signal);

    if (!fileData.data.dimensions) fileData.data.dimensions = {};
    if (!fileData.data.domainCompetence) fileData.data.domainCompetence = {};

    if (dim === "domain-competence" && domain) {
      fileData.data.domainCompetence[domain] = updateDim(
        fileData.data.domainCompetence[domain],
        score
      );
    } else {
      fileData.data.dimensions[dim] = updateDim(fileData.data.dimensions[dim], score);
    }

    const output = matter.stringify(fileData.content, fileData.data);
    await writeFile(filePath, output, "utf-8");

    return {
      content: [
        {
          type: "text" as const,
          text: `${isNew ? "Created" : "Updated"} reputation/${slug}.md — ${dim}${domain ? `:${domain}` : ""}: ${score}`,
        },
      ],
    };
  }
);

// --- Tool: awp_contract_create ---
server.registerTool(
  "awp_contract_create",
  {
    title: "Create Delegation Contract",
    description:
      "Create a new delegation contract between agents with task definition and evaluation criteria.",
    inputSchema: {
      slug: z.string().describe("Contract slug"),
      delegate: z.string().describe("Delegate agent DID"),
      delegateSlug: z.string().describe("Delegate reputation profile slug"),
      description: z.string().describe("Task description"),
      deadline: z.string().optional().describe("Deadline (ISO 8601)"),
      outputFormat: z.string().optional().describe("Expected output type"),
      outputSlug: z.string().optional().describe("Expected output artifact slug"),
      criteria: z
        .record(z.string(), z.number())
        .optional()
        .describe(
          "Evaluation criteria weights (default: completeness:0.3, accuracy:0.4, clarity:0.2, timeliness:0.1)"
        ),
    },
  },
  async ({
    slug,
    delegate,
    delegateSlug,
    description,
    deadline,
    outputFormat,
    outputSlug,
    criteria,
  }) => {
    const root = getWorkspaceRoot();
    const conDir = join(root, CONTRACTS_DIR);
    await mkdir(conDir, { recursive: true });

    const filePath = join(conDir, `${slug}.md`);
    const delegatorDid = await getAgentDid(root);
    const now = new Date().toISOString();

    const evalCriteria = criteria || {
      completeness: 0.3,
      accuracy: 0.4,
      clarity: 0.2,
      timeliness: 0.1,
    };

    const data: any = {
      awp: AWP_VERSION,
      rdp: RDP_VERSION,
      type: "delegation-contract",
      id: `contract:${slug}`,
      status: "active",
      delegator: delegatorDid,
      delegate,
      delegateSlug,
      created: now,
      task: { description },
      evaluation: { criteria: evalCriteria, result: null },
    };

    if (deadline) data.deadline = deadline;
    if (outputFormat) data.task.outputFormat = outputFormat;
    if (outputSlug) data.task.outputSlug = outputSlug;

    const body = `\n# ${slug} — Delegation Contract\n\nDelegated to ${delegateSlug}: ${description}\n\n## Status\nActive — awaiting completion.\n`;
    const output = matter.stringify(body, data);
    await writeFile(filePath, output, "utf-8");

    return {
      content: [
        {
          type: "text" as const,
          text: `Created contracts/${slug}.md (status: active)`,
        },
      ],
    };
  }
);

// --- Tool: awp_contract_evaluate ---
server.registerTool(
  "awp_contract_evaluate",
  {
    title: "Evaluate Delegation Contract",
    description:
      "Evaluate a completed contract with scores for each criterion. Generates reputation signals for the delegate automatically.",
    inputSchema: {
      slug: z.string().describe("Contract slug"),
      scores: z
        .record(z.string(), z.number().min(0).max(1))
        .describe("Map of criterion name to score (0.0-1.0)"),
    },
  },
  async ({ slug, scores }) => {
    const root = getWorkspaceRoot();
    const filePath = join(root, CONTRACTS_DIR, `${slug}.md`);

    let fileData: { data: any; content: string };
    try {
      const raw = await readFile(filePath, "utf-8");
      fileData = matter(raw);
    } catch {
      return {
        content: [{ type: "text" as const, text: `Contract "${slug}" not found.` }],
        isError: true,
      };
    }

    if (fileData.data.status === "evaluated") {
      return {
        content: [{ type: "text" as const, text: "Contract has already been evaluated." }],
        isError: true,
      };
    }

    const criteria = fileData.data.evaluation.criteria;
    const scoreMap = scores as Record<string, number>;
    let weightedScore = 0;
    for (const [name, weight] of Object.entries(criteria as Record<string, number>)) {
      if (scoreMap[name] === undefined) {
        return {
          content: [{ type: "text" as const, text: `Missing score for criterion: ${name}` }],
          isError: true,
        };
      }
      weightedScore += weight * scoreMap[name];
    }
    weightedScore = Math.round(weightedScore * 1000) / 1000;

    // Update contract
    fileData.data.status = "evaluated";
    fileData.data.evaluation.result = scores;
    const contractOutput = matter.stringify(fileData.content, fileData.data);
    await writeFile(filePath, contractOutput, "utf-8");

    // Generate reputation signal for delegate
    const evaluatorDid = await getAgentDid(root);
    const delegateSlug = fileData.data.delegateSlug;
    const now = new Date();
    const timestamp = now.toISOString();

    const signal = {
      source: evaluatorDid,
      dimension: "reliability",
      score: weightedScore,
      timestamp,
      evidence: fileData.data.id,
      message: `Contract evaluation: ${fileData.data.task.description}`,
    };

    // Try to update delegate's reputation profile
    const repPath = join(root, REPUTATION_DIR, `${delegateSlug}.md`);
    let repUpdated = false;
    try {
      const repRaw = await readFile(repPath, "utf-8");
      const repData = matter(repRaw);
      repData.data.lastUpdated = timestamp;
      repData.data.signals.push(signal);

      if (!repData.data.dimensions) repData.data.dimensions = {};
      const existing = repData.data.dimensions.reliability;
      const ALPHA = 0.15;
      const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;

      if (existing) {
        const months = (now.getTime() - new Date(existing.lastSignal).getTime()) / MS_PER_MONTH;
        const decayFactor = months > 0 ? Math.exp(-0.02 * months) : 1;
        const decayed = 0.5 + (existing.score - 0.5) * decayFactor;
        const newScore = ALPHA * weightedScore + (1 - ALPHA) * decayed;
        const newSampleSize = existing.sampleSize + 1;
        repData.data.dimensions.reliability = {
          score: Math.round(newScore * 1000) / 1000,
          confidence: Math.round((1 - 1 / (1 + newSampleSize * 0.1)) * 100) / 100,
          sampleSize: newSampleSize,
          lastSignal: timestamp,
        };
      } else {
        repData.data.dimensions.reliability = {
          score: weightedScore,
          confidence: Math.round((1 - 1 / (1 + 1 * 0.1)) * 100) / 100,
          sampleSize: 1,
          lastSignal: timestamp,
        };
      }

      const repOutput = matter.stringify(repData.content, repData.data);
      await writeFile(repPath, repOutput, "utf-8");
      repUpdated = true;
    } catch {
      // No profile — that's OK
    }

    const resultText = [
      `Evaluated contracts/${slug}.md — weighted score: ${weightedScore}`,
      repUpdated
        ? `Updated reputation/${delegateSlug}.md with reliability signal`
        : `Note: No reputation profile for ${delegateSlug} — signal not recorded`,
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: resultText }],
    };
  }
);

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

    const data: any = {
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

    const projects: any[] = [];
    for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
      try {
        const raw = await readFile(join(projDir, f), "utf-8");
        const { data } = matter(raw);
        if (data.type !== "project") continue;
        if (statusFilter && data.status !== statusFilter) continue;
        projects.push({
          slug: f.replace(/\.md$/, ""),
          title: data.title,
          status: data.status,
          taskCount: data.taskCount || 0,
          completedCount: data.completedCount || 0,
          deadline: data.deadline,
          owner: data.owner,
          memberCount: data.members?.length || 0,
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
      const tasks: any[] = [];
      try {
        const taskDir = join(root, PROJECTS_DIR, slug, "tasks");
        const taskFiles = await readdir(taskDir);
        for (const tf of taskFiles.filter((t: string) => t.endsWith(".md")).sort()) {
          try {
            const tRaw = await readFile(join(taskDir, tf), "utf-8");
            const { data: tData } = matter(tRaw);
            tasks.push({
              slug: tf.replace(/\.md$/, ""),
              title: tData.title,
              status: tData.status,
              assigneeSlug: tData.assigneeSlug,
              priority: tData.priority,
              deadline: tData.deadline,
              blockedBy: tData.blockedBy || [],
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
    let projData: { data: any; content: string };
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

    const data: any = {
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
    projData.data.taskCount = (projData.data.taskCount || 0) + 1;
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

    let taskData: { data: any; content: string };
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

    const tasks: any[] = [];
    for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
      try {
        const raw = await readFile(join(taskDir, f), "utf-8");
        const { data } = matter(raw);
        if (data.type !== "task") continue;
        if (statusFilter && data.status !== statusFilter) continue;
        if (assigneeSlug && data.assigneeSlug !== assigneeSlug) continue;
        tasks.push({
          slug: f.replace(/\.md$/, ""),
          title: data.title,
          status: data.status,
          assigneeSlug: data.assigneeSlug,
          priority: data.priority,
          deadline: data.deadline,
          blockedBy: data.blockedBy || [],
          blocks: data.blocks || [],
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

// --- Tool: awp_artifact_merge ---
server.registerTool(
  "awp_artifact_merge",
  {
    title: "Merge Artifacts",
    description:
      "Merge a source artifact into a target artifact. Supports 'additive' (append) and 'authority' (reputation-based ordering) strategies.",
    inputSchema: {
      targetSlug: z.string().describe("Target artifact slug"),
      sourceSlug: z.string().describe("Source artifact slug"),
      strategy: z
        .string()
        .optional()
        .describe("Merge strategy: 'additive' (default) or 'authority'"),
      message: z.string().optional().describe("Merge message"),
    },
  },
  async ({ targetSlug, sourceSlug, strategy: strat, message }) => {
    const root = getWorkspaceRoot();
    const strategy = strat || "additive";

    if (strategy !== "additive" && strategy !== "authority") {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown strategy "${strategy}". Use "additive" or "authority".`,
          },
        ],
        isError: true,
      };
    }

    let targetRaw: string, sourceRaw: string;
    try {
      targetRaw = await readFile(join(root, ARTIFACTS_DIR, `${targetSlug}.md`), "utf-8");
    } catch {
      return {
        content: [{ type: "text" as const, text: `Target artifact "${targetSlug}" not found.` }],
        isError: true,
      };
    }
    try {
      sourceRaw = await readFile(join(root, ARTIFACTS_DIR, `${sourceSlug}.md`), "utf-8");
    } catch {
      return {
        content: [{ type: "text" as const, text: `Source artifact "${sourceSlug}" not found.` }],
        isError: true,
      };
    }

    const target = matter(targetRaw);
    const source = matter(sourceRaw);
    const did = await getAgentDid(root);
    const now = new Date();
    const nowIso = now.toISOString();
    const tfm = target.data;
    const sfm = source.data;

    if (strategy === "authority") {
      // Authority merge using reputation
      const sharedTags = (tfm.tags || []).filter((t: string) => (sfm.tags || []).includes(t));
      const targetAuthor = tfm.authors?.[0] || "anonymous";
      const sourceAuthor = sfm.authors?.[0] || "anonymous";

      // Look up reputation scores
      const getScore = async (authorDid: string): Promise<number> => {
        const repDir = join(root, REPUTATION_DIR);
        try {
          const repFiles = await readdir(repDir);
          for (const f of repFiles.filter((f) => f.endsWith(".md"))) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let data: any;
            try {
              const raw = await readFile(join(repDir, f), "utf-8");
              ({ data } = matter(raw));
            } catch {
              continue; // skip corrupted reputation files
            }
            if (data.agentDid !== authorDid) continue;
            const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000;
            let best = 0;
            // Check domain scores for shared tags
            for (const tag of sharedTags) {
              const dim = data.domainCompetence?.[tag];
              if (dim) {
                const months = (now.getTime() - new Date(dim.lastSignal).getTime()) / MS_PER_MONTH;
                const factor = months > 0 ? Math.exp(-0.02 * months) : 1;
                const decayed = 0.5 + (dim.score - 0.5) * factor;
                if (decayed > best) best = decayed;
              }
            }
            // Fallback to reliability
            if (best === 0 && data.dimensions?.reliability) {
              const dim = data.dimensions.reliability;
              const months = (now.getTime() - new Date(dim.lastSignal).getTime()) / MS_PER_MONTH;
              const factor = months > 0 ? Math.exp(-0.02 * months) : 1;
              best = 0.5 + (dim.score - 0.5) * factor;
            }
            return best;
          }
        } catch {
          /* no reputation */
        }
        return 0;
      };

      const targetScore = await getScore(targetAuthor);
      const sourceScore = await getScore(sourceAuthor);
      const targetIsHigher = targetScore >= sourceScore;

      const higherBody = targetIsHigher ? target.content.trim() : source.content.trim();
      const lowerBody = targetIsHigher ? source.content.trim() : target.content.trim();
      const lowerAuthor = targetIsHigher ? sourceAuthor : targetAuthor;
      const lowerScore = targetIsHigher ? sourceScore : targetScore;
      const higherScore = targetIsHigher ? targetScore : sourceScore;

      target.content = `\n${higherBody}\n\n---\n*Authority merge: content below from ${lowerAuthor} (authority score: ${lowerScore.toFixed(2)} vs ${higherScore.toFixed(2)})*\n\n${lowerBody}\n`;
    } else {
      // Additive merge
      const separator = `\n---\n*Merged from ${sfm.id} (version ${sfm.version}) on ${nowIso}*\n\n`;
      target.content += separator + source.content.trim() + "\n";
    }

    // Union authors
    for (const author of sfm.authors || []) {
      if (!tfm.authors?.includes(author)) {
        if (!tfm.authors) tfm.authors = [];
        tfm.authors.push(author);
      }
    }
    if (!tfm.authors?.includes(did)) {
      if (!tfm.authors) tfm.authors = [];
      tfm.authors.push(did);
    }

    // Union tags
    if (sfm.tags) {
      if (!tfm.tags) tfm.tags = [];
      for (const tag of sfm.tags) {
        if (!tfm.tags.includes(tag)) tfm.tags.push(tag);
      }
    }

    // Confidence: minimum
    if (tfm.confidence !== undefined && sfm.confidence !== undefined) {
      tfm.confidence = Math.min(tfm.confidence, sfm.confidence);
    } else if (sfm.confidence !== undefined) {
      tfm.confidence = sfm.confidence;
    }

    // Bump version + provenance
    tfm.version = (tfm.version || 1) + 1;
    tfm.lastModified = nowIso;
    tfm.modifiedBy = did;
    if (!tfm.provenance) tfm.provenance = [];
    tfm.provenance.push({
      agent: did,
      action: "merged",
      timestamp: nowIso,
      message: message || `Merged from ${sfm.id} (version ${sfm.version}, strategy: ${strategy})`,
      confidence: tfm.confidence,
    });

    const output = matter.stringify(target.content, tfm);
    await writeFile(join(root, ARTIFACTS_DIR, `${targetSlug}.md`), output, "utf-8");

    return {
      content: [
        {
          type: "text" as const,
          text: `Merged ${sfm.id} into ${tfm.id} (now version ${tfm.version}, strategy: ${strategy})`,
        },
      ],
    };
  }
);

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

// --- Tool: awp_contract_list ---
server.registerTool(
  "awp_contract_list",
  {
    title: "List Delegation Contracts",
    description: "List all delegation contracts with optional status filter",
    inputSchema: {
      status: z
        .string()
        .optional()
        .describe("Filter by status (active, completed, evaluated, cancelled)"),
    },
  },
  async ({ status: statusFilter }) => {
    const root = getWorkspaceRoot();
    const contractsDir = join(root, CONTRACTS_DIR);

    let files: string[];
    try {
      files = await readdir(contractsDir);
    } catch {
      return {
        content: [{ type: "text" as const, text: "No contracts directory found." }],
      };
    }

    const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
    const contracts: Array<{
      slug: string;
      status: string;
      delegate: string;
      delegateSlug: string;
      created: string;
      deadline?: string;
    }> = [];

    for (const f of mdFiles) {
      try {
        const raw = await readFile(join(contractsDir, f), "utf-8");
        const { data } = matter(raw);
        if (data.type === "delegation-contract") {
          if (!statusFilter || data.status === statusFilter) {
            contracts.push({
              slug: f.replace(".md", ""),
              status: data.status || "unknown",
              delegate: data.delegate || "unknown",
              delegateSlug: data.delegateSlug || "unknown",
              created: data.created || "unknown",
              deadline: data.deadline,
            });
          }
        }
      } catch {
        // Skip unparseable files
      }
    }

    if (contracts.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: statusFilter
              ? `No contracts with status: ${statusFilter}`
              : "No contracts found.",
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(contracts, null, 2),
        },
      ],
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
