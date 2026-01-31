import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as z from "zod";
import { AWP_VERSION, RDP_VERSION, REPUTATION_DIR } from "@agent-workspace/core";
import type { ReputationDimension } from "@agent-workspace/core";
import {
  getWorkspaceRoot,
  getAgentDid,
  computeDecayedScore,
  updateDimension,
} from "@agent-workspace/utils";

/**
 * Register reputation-related tools: query, signal
 */
export function registerReputationTools(server: McpServer): void {
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
        const profiles: Record<string, unknown>[] = [];
        for (const f of files.filter((f) => f.endsWith(".md")).sort()) {
          try {
            const raw = await readFile(join(repDir, f), "utf-8");
            const { data } = matter(raw);
            if (data.type !== "reputation-profile") continue;
            const signals = data.signals as unknown[] | undefined;
            const dimensions = data.dimensions as Record<string, unknown> | undefined;
            const domainCompetence = data.domainCompetence as Record<string, unknown> | undefined;
            profiles.push({
              slug: f.replace(/\.md$/, ""),
              agentName: data.agentName,
              agentDid: data.agentDid,
              signalCount: signals?.length || 0,
              dimensions: Object.keys(dimensions || {}),
              domains: Object.keys(domainCompetence || {}),
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

        const applyDecay = (dim: ReputationDimension) => {
          if (!dim?.lastSignal) return dim;
          const decayedScore = computeDecayedScore(dim, now);
          return { ...dim, decayedScore };
        };

        const result: Record<string, unknown> = { ...data, body: content.trim() };

        // Apply decay to dimensions
        const dimensions = data.dimensions as Record<string, ReputationDimension> | undefined;
        if (dimensions) {
          result.dimensions = {};
          const resultDimensions = result.dimensions as Record<string, unknown>;
          for (const [name, dim] of Object.entries(dimensions)) {
            if (dimension && name !== dimension) continue;
            resultDimensions[name] = applyDecay(dim);
          }
        }
        const domainCompetence = data.domainCompetence as
          | Record<string, ReputationDimension>
          | undefined;
        if (domainCompetence) {
          result.domainCompetence = {};
          const resultDomains = result.domainCompetence as Record<string, unknown>;
          for (const [name, dim] of Object.entries(domainCompetence)) {
            if (domain && name !== domain) continue;
            resultDomains[name] = applyDecay(dim);
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

      const signal: Record<string, unknown> = {
        source: sourceDid,
        dimension: dim,
        score,
        timestamp,
      };
      if (domain) signal.domain = domain;
      if (evidence) signal.evidence = evidence;
      if (message) signal.message = message;

      let isNew = false;
      let fileData: { data: Record<string, unknown>; content: string };

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
      const signals = fileData.data.signals as unknown[];
      signals.push(signal);

      if (!fileData.data.dimensions) fileData.data.dimensions = {};
      if (!fileData.data.domainCompetence) fileData.data.domainCompetence = {};

      const dimensions = fileData.data.dimensions as Record<string, ReputationDimension>;
      const domainCompetence = fileData.data.domainCompetence as Record<
        string,
        ReputationDimension
      >;

      if (dim === "domain-competence" && domain) {
        domainCompetence[domain] = updateDimension(domainCompetence[domain], score, now);
      } else {
        dimensions[dim] = updateDimension(dimensions[dim], score, now);
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
}
