/**
 * AWP tools in OpenAI function calling format.
 *
 * These tool definitions mirror the MCP server tools but are formatted
 * for OpenAI's function calling API.
 */

import { readFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import {
  AWP_VERSION,
  SMP_VERSION,
  RDP_VERSION,
  ARTIFACTS_DIR,
  CONTRACTS_DIR,
  REPUTATION_DIR,
} from "@agent-workspace/core";
import { getAgentDid, updateDimension, atomicWriteFile, withFileLock } from "@agent-workspace/utils";
import type { ReputationDimension, ReputationSignal } from "@agent-workspace/core";
import type { ToolDefinition, ToolCall } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tool Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core AWP tools available to agents during task execution.
 * Subset of MCP tools most relevant for experiments.
 */
export const AWP_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "awp_artifact_read",
      description:
        "Read a knowledge artifact by slug. Returns metadata (title, version, confidence) and body content.",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "Artifact slug (e.g., 'llm-context-research')",
          },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "awp_artifact_write",
      description:
        "Create or update a knowledge artifact. If it exists, increments version. If new, creates it.",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "Artifact slug (lowercase, hyphens only)",
          },
          title: {
            type: "string",
            description: "Title (required for new artifacts)",
          },
          content: {
            type: "string",
            description: "Markdown body content",
          },
          confidence: {
            type: "number",
            description: "Confidence score (0.0-1.0)",
          },
          message: {
            type: "string",
            description: "Commit message for provenance",
          },
        },
        required: ["slug", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "awp_artifact_list",
      description: "List all knowledge artifacts in the workspace with metadata",
      parameters: {
        type: "object",
        properties: {
          tag: {
            type: "string",
            description: "Filter by tag (optional)",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "awp_contract_accept",
      description: "Accept a delegation contract and mark it as in-progress",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "Contract slug",
          },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "awp_contract_complete",
      description: "Mark a contract as completed with output reference",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "Contract slug",
          },
          outputSlug: {
            type: "string",
            description: "Slug of the output artifact",
          },
          message: {
            type: "string",
            description: "Completion message",
          },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "awp_reputation_query",
      description: "Query reputation profile for an agent",
      parameters: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "Reputation profile slug",
          },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_complete",
      description:
        "Signal that the current task is complete. Call this when you have finished the work.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description: "Brief summary of what was accomplished",
          },
          outputSlug: {
            type: "string",
            description: "Slug of the main output artifact (if any)",
          },
        },
        required: ["summary"],
      },
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tool Execution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a tool call and return the result as a string.
 *
 * @param workspace - Path to the agent's workspace
 * @param name - Tool name
 * @param args - Tool arguments
 * @returns Result string or error message
 */
export async function executeToolCall(
  workspace: string,
  name: string,
  args: Record<string, unknown>
): Promise<{ result: string; isError?: boolean; isComplete?: boolean }> {
  try {
    switch (name) {
      case "awp_artifact_read":
        return await executeArtifactRead(workspace, args.slug as string);

      case "awp_artifact_write":
        return await executeArtifactWrite(workspace, {
          slug: args.slug as string,
          title: args.title as string | undefined,
          content: args.content as string,
          confidence: args.confidence as number | undefined,
          message: args.message as string | undefined,
        });

      case "awp_artifact_list":
        return await executeArtifactList(workspace, args.tag as string | undefined);

      case "awp_contract_accept":
        return await executeContractAccept(workspace, args.slug as string);

      case "awp_contract_complete":
        return await executeContractComplete(workspace, {
          slug: args.slug as string,
          outputSlug: args.outputSlug as string | undefined,
          message: args.message as string | undefined,
        });

      case "awp_reputation_query":
        return await executeReputationQuery(workspace, args.slug as string);

      case "task_complete":
        return {
          result: `Task complete: ${args.summary as string}`,
          isComplete: true,
        };

      default:
        return { result: `Unknown tool: ${name}`, isError: true };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { result: `Error executing ${name}: ${message}`, isError: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tool Implementations
// ─────────────────────────────────────────────────────────────────────────────

async function executeArtifactRead(
  workspace: string,
  slug: string
): Promise<{ result: string; isError?: boolean }> {
  const path = join(workspace, ARTIFACTS_DIR, `${slug}.md`);
  try {
    const raw = await readFile(path, "utf-8");
    const { data, content } = matter(raw);
    return {
      result: JSON.stringify(
        {
          frontmatter: {
            title: data.title,
            version: data.version,
            confidence: data.confidence,
            tags: data.tags,
            authors: data.authors,
            lastModified: data.lastModified,
          },
          body: content.trim(),
        },
        null,
        2
      ),
    };
  } catch {
    return { result: `Artifact "${slug}" not found.`, isError: true };
  }
}

async function executeArtifactWrite(
  workspace: string,
  params: {
    slug: string;
    title?: string;
    content: string;
    confidence?: number;
    message?: string;
  }
): Promise<{ result: string }> {
  const { slug, title, content: bodyContent, confidence, message } = params;
  const artifactsDir = join(workspace, ARTIFACTS_DIR);
  await mkdir(artifactsDir, { recursive: true });

  const filePath = join(artifactsDir, `${slug}.md`);
  const did = await getAgentDid(workspace);
  const now = new Date().toISOString();

  return withFileLock(filePath, async () => {
    let fileData: { data: Record<string, unknown>; content: string };
    let version: number;
    let isNew = false;

    try {
      const raw = await readFile(filePath, "utf-8");
      fileData = matter(raw);

      // Update existing
      fileData.data.version = ((fileData.data.version as number) || 1) + 1;
      version = fileData.data.version as number;
      fileData.data.lastModified = now;
      fileData.data.modifiedBy = did;
      fileData.content = `\n${bodyContent}\n`;

      if (confidence !== undefined) fileData.data.confidence = confidence;
      if (title) fileData.data.title = title;

      // Add author if new
      const authors = fileData.data.authors as string[] | undefined;
      if (!authors?.includes(did)) {
        if (!fileData.data.authors) fileData.data.authors = [];
        (fileData.data.authors as string[]).push(did);
      }

      // Append provenance
      if (!fileData.data.provenance) fileData.data.provenance = [];
      (fileData.data.provenance as unknown[]).push({
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
    await atomicWriteFile(filePath, output);

    return {
      result: `${isNew ? "Created" : "Updated"} artifacts/${slug}.md (version ${version})`,
    };
  });
}

async function executeArtifactList(workspace: string, tag?: string): Promise<{ result: string }> {
  const artifactsDir = join(workspace, ARTIFACTS_DIR);

  let files: string[];
  try {
    files = await readdir(artifactsDir);
  } catch {
    return { result: JSON.stringify({ artifacts: [] }, null, 2) };
  }

  const mdFiles = files.filter((f) => f.endsWith(".md")).sort();
  const artifacts: Record<string, unknown>[] = [];

  for (const f of mdFiles) {
    try {
      const raw = await readFile(join(artifactsDir, f), "utf-8");
      const { data } = matter(raw);
      if (data.type !== "knowledge-artifact") continue;

      const dataTags = data.tags as string[] | undefined;
      if (tag && !dataTags?.some((t: string) => t.toLowerCase() === tag.toLowerCase())) {
        continue;
      }

      artifacts.push({
        slug: f.replace(/\.md$/, ""),
        title: data.title,
        version: data.version,
        confidence: data.confidence,
      });
    } catch {
      // Skip
    }
  }

  return { result: JSON.stringify({ artifacts }, null, 2) };
}

async function executeContractAccept(
  workspace: string,
  slug: string
): Promise<{ result: string; isError?: boolean }> {
  const contractPath = join(workspace, CONTRACTS_DIR, `${slug}.md`);

  try {
    return await withFileLock(contractPath, async () => {
      const raw = await readFile(contractPath, "utf-8");
      const { data, content } = matter(raw);

      if (data.status !== "active") {
        return {
          result: `Contract "${slug}" is not active (status: ${data.status})`,
          isError: true,
        };
      }

      data.status = "in-progress";
      data.acceptedAt = new Date().toISOString();

      const output = matter.stringify(content, data);
      await atomicWriteFile(contractPath, output);

      return { result: `Accepted contract "${slug}" — now in-progress` };
    });
  } catch {
    return { result: `Contract "${slug}" not found`, isError: true };
  }
}

async function executeContractComplete(
  workspace: string,
  params: { slug: string; outputSlug?: string; message?: string }
): Promise<{ result: string; isError?: boolean }> {
  const { slug, outputSlug, message } = params;
  const contractPath = join(workspace, CONTRACTS_DIR, `${slug}.md`);

  try {
    return await withFileLock(contractPath, async () => {
      const raw = await readFile(contractPath, "utf-8");
      const { data, content } = matter(raw);

      data.status = "completed";
      data.completedAt = new Date().toISOString();
      if (outputSlug) data.outputSlug = outputSlug;
      if (message) data.completionMessage = message;

      const output = matter.stringify(content, data);
      await atomicWriteFile(contractPath, output);

      return { result: `Completed contract "${slug}"` };
    });
  } catch {
    return { result: `Contract "${slug}" not found`, isError: true };
  }
}

async function executeReputationQuery(
  workspace: string,
  slug: string
): Promise<{ result: string; isError?: boolean }> {
  const repPath = join(workspace, REPUTATION_DIR, `${slug}.md`);

  try {
    const raw = await readFile(repPath, "utf-8");
    const { data } = matter(raw);

    return {
      result: JSON.stringify(
        {
          agentDid: data.agentDid,
          agentName: data.agentName,
          dimensions: data.dimensions,
          lastUpdated: data.lastUpdated,
        },
        null,
        2
      ),
    };
  } catch {
    return { result: `Reputation profile "${slug}" not found`, isError: true };
  }
}
