import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as z from "zod";
import { AWP_VERSION, RDP_VERSION, CONTRACTS_DIR, REPUTATION_DIR } from "@agent-workspace/core";
import type { ReputationDimension } from "@agent-workspace/core";
import { getWorkspaceRoot, getAgentDid, updateDimension } from "@agent-workspace/utils";

/**
 * Register contract-related tools: create, evaluate, list
 */
export function registerContractTools(server: McpServer): void {
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

      const data: Record<string, unknown> = {
        awp: AWP_VERSION,
        rdp: RDP_VERSION,
        type: "delegation-contract",
        id: `contract:${slug}`,
        status: "active",
        delegator: delegatorDid,
        delegate,
        delegateSlug,
        created: now,
        task: { description } as Record<string, unknown>,
        evaluation: { criteria: evalCriteria, result: null },
      };

      if (deadline) data.deadline = deadline;
      const task = data.task as Record<string, unknown>;
      if (outputFormat) task.outputFormat = outputFormat;
      if (outputSlug) task.outputSlug = outputSlug;

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

      let fileData: { data: Record<string, unknown>; content: string };
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

      const evaluation = fileData.data.evaluation as Record<string, unknown>;
      const criteria = evaluation.criteria as Record<string, number>;
      const scoreMap = scores as Record<string, number>;
      let weightedScore = 0;
      for (const [name, weight] of Object.entries(criteria)) {
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
      evaluation.result = scores;
      const contractOutput = matter.stringify(fileData.content, fileData.data);
      await writeFile(filePath, contractOutput, "utf-8");

      // Generate reputation signal for delegate
      const evaluatorDid = await getAgentDid(root);
      const delegateSlug = fileData.data.delegateSlug as string;
      const now = new Date();
      const timestamp = now.toISOString();

      const task = fileData.data.task as Record<string, unknown>;
      const signal = {
        source: evaluatorDid,
        dimension: "reliability",
        score: weightedScore,
        timestamp,
        evidence: fileData.data.id,
        message: `Contract evaluation: ${task.description}`,
      };

      // Try to update delegate's reputation profile
      const repPath = join(root, REPUTATION_DIR, `${delegateSlug}.md`);
      let repUpdated = false;
      try {
        const repRaw = await readFile(repPath, "utf-8");
        const repData = matter(repRaw);
        repData.data.lastUpdated = timestamp;
        const signals = repData.data.signals as unknown[];
        signals.push(signal);

        if (!repData.data.dimensions) repData.data.dimensions = {};
        const dimensions = repData.data.dimensions as Record<string, ReputationDimension>;
        dimensions.reliability = updateDimension(dimensions.reliability, weightedScore, now);

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
                status: (data.status as string) || "unknown",
                delegate: (data.delegate as string) || "unknown",
                delegateSlug: (data.delegateSlug as string) || "unknown",
                created: (data.created as string) || "unknown",
                deadline: data.deadline as string | undefined,
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
}
