import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import * as z from "zod";
import { getWorkspaceRoot } from "@agent-workspace/utils";

// Re-use types from agent package (loaded dynamically as JSON)
import type { ExperimentResult } from "@agent-workspace/agent";
import {
  compareExperiments,
  computeDescriptiveStats,
} from "@agent-workspace/agent";

const SOCIETIES_DIR = "societies";

function getSocietiesRoot(): string {
  return process.env.AWP_SOCIETIES || join(getWorkspaceRoot(), SOCIETIES_DIR);
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadExperiment(
  societyId: string,
  experimentId: string
): Promise<ExperimentResult | null> {
  const root = getSocietiesRoot();
  try {
    const raw = await readFile(
      join(root, societyId, "metrics", experimentId + ".json"),
      "utf-8"
    );
    return JSON.parse(raw) as ExperimentResult;
  } catch {
    return null;
  }
}

async function listExperimentFiles(societyId: string): Promise<string[]> {
  const metricsDir = join(getSocietiesRoot(), societyId, "metrics");
  try {
    const files = await readdir(metricsDir);
    return files.filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

/**
 * Register experiment-related tools.
 */
export function registerExperimentTools(server: McpServer): void {
  // --- Tool: awp_experiment_list ---
  server.registerTool(
    "awp_experiment_list",
    {
      title: "List Experiments",
      description:
        "List experiment results for a society. Returns experiment IDs, timestamps, success rates, and task counts.",
      inputSchema: {
        societyId: z.string().describe("Society ID to list experiments for"),
      },
    },
    async ({ societyId }) => {
      const files = await listExperimentFiles(societyId);

      const experiments: Record<string, unknown>[] = [];
      for (const file of files) {
        const expId = file.replace(/\.json$/, "");
        const exp = await loadExperiment(societyId, expId);
        if (!exp) continue;

        experiments.push({
          experimentId: exp.experimentId,
          startedAt: exp.startedAt,
          endedAt: exp.endedAt,
          totalCycles: exp.totalCycles,
          overallSuccessRate: exp.aggregateMetrics.overallSuccessRate,
          totalTasks: exp.aggregateMetrics.totalTasks,
          totalTokens: exp.aggregateMetrics.totalTokens,
          criteriaMetCount: exp.successCriteriaResults.filter((c) => c.met).length,
          criteriaTotalCount: exp.successCriteriaResults.length,
        });
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ societyId, experiments }, null, 2),
          },
        ],
      };
    }
  );

  // --- Tool: awp_experiment_show ---
  server.registerTool(
    "awp_experiment_show",
    {
      title: "Show Experiment",
      description:
        "Show detailed results for a specific experiment including aggregate metrics, per-cycle data, final reputations, and success criteria.",
      inputSchema: {
        societyId: z.string().describe("Society ID"),
        experimentId: z.string().describe("Experiment ID"),
        cycleDetail: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include full per-cycle breakdown (can be large)"),
      },
    },
    async ({ societyId, experimentId, cycleDetail }) => {
      const exp = await loadExperiment(societyId, experimentId);
      if (!exp) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Experiment "${experimentId}" not found in society "${societyId}".`,
            },
          ],
          isError: true,
        };
      }

      // Build a summary view (full cycles can be large)
      const result: Record<string, unknown> = {
        experimentId: exp.experimentId,
        manifestoId: exp.manifestoId,
        societyId: exp.societyId,
        startedAt: exp.startedAt,
        endedAt: exp.endedAt,
        totalCycles: exp.totalCycles,
        aggregateMetrics: exp.aggregateMetrics,
        successCriteria: exp.successCriteriaResults,
        finalReputations: Object.fromEntries(
          Object.entries(exp.finalReputations).map(([id, rep]) => [
            id,
            { name: rep.agentName, overallScore: rep.overallScore },
          ])
        ),
      };

      if (cycleDetail) {
        result.cycles = exp.cycles;
      } else {
        // Compact cycle summary
        result.cycleSummary = exp.cycles.map((c) => ({
          cycle: c.cycleNumber,
          successRate: c.metrics.successRate,
          tasksAttempted: c.metrics.tasksAttempted,
          totalTokens: c.metrics.totalTokens,
          antiPatterns: c.metrics.antiPatternsDetected.length,
        }));
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // --- Tool: awp_experiment_compare ---
  server.registerTool(
    "awp_experiment_compare",
    {
      title: "Compare Experiments",
      description:
        "Statistically compare two experiments using Welch's t-test or Mann-Whitney U test. " +
        "Compares Success Rate, Token Efficiency, Trust Stability, Anti-Pattern Rate, and Final Reputation. " +
        "Reports p-values, significance, effect sizes, and an overall winner.",
      inputSchema: {
        societyA: z.string().describe("Society ID for experiment A"),
        experimentA: z.string().describe("Experiment ID for experiment A"),
        societyB: z.string().describe("Society ID for experiment B"),
        experimentB: z.string().describe("Experiment ID for experiment B"),
        test: z
          .enum(["t-test", "mann-whitney"])
          .optional()
          .default("t-test")
          .describe("Statistical test to use"),
        alpha: z
          .number()
          .optional()
          .default(0.05)
          .describe("Significance level (default 0.05)"),
      },
    },
    async ({ societyA, experimentA, societyB, experimentB, test, alpha }) => {
      const expA = await loadExperiment(societyA, experimentA);
      if (!expA) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Experiment A "${experimentA}" not found in society "${societyA}".`,
            },
          ],
          isError: true,
        };
      }

      const expB = await loadExperiment(societyB, experimentB);
      if (!expB) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Experiment B "${experimentB}" not found in society "${societyB}".`,
            },
          ],
          isError: true,
        };
      }

      const comparison = compareExperiments(expA, expB, { alpha, test });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(comparison, null, 2) }],
      };
    }
  );

  // --- Tool: awp_experiment_metrics ---
  server.registerTool(
    "awp_experiment_metrics",
    {
      title: "Experiment Metrics",
      description:
        "Extract and compute descriptive statistics for a specific metric across experiment cycles. " +
        "Useful for understanding distribution, variability, and trends.",
      inputSchema: {
        societyId: z.string().describe("Society ID"),
        experimentId: z.string().describe("Experiment ID"),
        metric: z
          .enum([
            "success-rate",
            "total-tokens",
            "tasks-attempted",
            "tasks-succeeded",
            "anti-patterns",
            "avg-task-duration",
          ])
          .describe("Metric to extract"),
      },
    },
    async ({ societyId, experimentId, metric }) => {
      const exp = await loadExperiment(societyId, experimentId);
      if (!exp) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Experiment "${experimentId}" not found in society "${societyId}".`,
            },
          ],
          isError: true,
        };
      }

      const extractors: Record<string, (exp: ExperimentResult) => number[]> = {
        "success-rate": (e) => e.cycles.map((c) => c.metrics.successRate),
        "total-tokens": (e) => e.cycles.map((c) => c.metrics.totalTokens),
        "tasks-attempted": (e) => e.cycles.map((c) => c.metrics.tasksAttempted),
        "tasks-succeeded": (e) => e.cycles.map((c) => c.metrics.tasksSucceeded),
        "anti-patterns": (e) =>
          e.cycles.map((c) => c.metrics.antiPatternsDetected.length),
        "avg-task-duration": (e) => e.cycles.map((c) => c.metrics.avgTaskDurationMs),
      };

      const values = extractors[metric](exp);
      const stats = computeDescriptiveStats(values);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                experimentId,
                metric,
                perCycle: values,
                stats,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
