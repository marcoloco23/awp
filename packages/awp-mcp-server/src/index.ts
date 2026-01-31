#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { AWP_VERSION, SMP_VERSION, RDP_VERSION, MEMORY_DIR, ARTIFACTS_DIR, REPUTATION_DIR, CONTRACTS_DIR } from "@agent-workspace/core";

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

    return {
      content: [
        { type: "text" as const, text: JSON.stringify(status, null, 2) },
      ],
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
        } catch { /* skip */ }
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
      dimension: z.string().describe("Dimension (reliability, epistemic-hygiene, coordination, domain-competence)"),
      score: z.number().min(0).max(1).describe("Score (0.0-1.0)"),
      domain: z.string().optional().describe("Domain (required for domain-competence)"),
      evidence: z.string().optional().describe("Evidence reference"),
      message: z.string().optional().describe("Human-readable note"),
      agentDid: z.string().optional().describe("Agent DID (required for new profiles)"),
      agentName: z.string().optional().describe("Agent name (required for new profiles)"),
    },
  },
  async ({ slug, dimension: dim, score, domain, evidence, message, agentDid: newDid, agentName: newName }) => {
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
          content: [{ type: "text" as const, text: "Error: agentDid and agentName required for new profiles." }],
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
      fileData.data.domainCompetence[domain] = updateDim(fileData.data.domainCompetence[domain], score);
    } else {
      fileData.data.dimensions[dim] = updateDim(fileData.data.dimensions[dim], score);
    }

    const output = matter.stringify(fileData.content, fileData.data);
    await writeFile(filePath, output, "utf-8");

    return {
      content: [{
        type: "text" as const,
        text: `${isNew ? "Created" : "Updated"} reputation/${slug}.md — ${dim}${domain ? `:${domain}` : ""}: ${score}`,
      }],
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
      criteria: z.record(z.string(), z.number()).optional().describe("Evaluation criteria weights (default: completeness:0.3, accuracy:0.4, clarity:0.2, timeliness:0.1)"),
    },
  },
  async ({ slug, delegate, delegateSlug, description, deadline, outputFormat, outputSlug, criteria }) => {
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
      content: [{
        type: "text" as const,
        text: `Created contracts/${slug}.md (status: active)`,
      }],
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
      scores: z.record(z.string(), z.number().min(0).max(1)).describe("Map of criterion name to score (0.0-1.0)"),
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
      repUpdated ? `Updated reputation/${delegateSlug}.md with reliability signal` : `Note: No reputation profile for ${delegateSlug} — signal not recorded`,
    ].join("\n");

    return {
      content: [{ type: "text" as const, text: resultText }],
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
