import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import * as z from "zod";
import { AWP_VERSION, SMP_VERSION, ARTIFACTS_DIR, REPUTATION_DIR } from "@agent-workspace/core";
import { getWorkspaceRoot, getAgentDid, computeDecayedScore } from "@agent-workspace/utils";
import type { ReputationDimension } from "@agent-workspace/core";

/**
 * Register artifact-related tools: read, write, list, search, merge
 */
export function registerArtifactTools(server: McpServer): void {
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
        if (tags) fileData.data.tags = tags;
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
      const results: Record<string, unknown>[] = [];

      for (const f of mdFiles) {
        try {
          const raw = await readFile(join(artifactsDir, f), "utf-8");
          const { data, content } = matter(raw);
          if (data.type !== "knowledge-artifact") continue;

          const titleMatch = (data.title as string)?.toLowerCase().includes(queryLower);
          const dataTags = data.tags as string[] | undefined;
          const tagMatch = dataTags?.some((t: string) => t.toLowerCase().includes(queryLower));
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
      const tfm = target.data as Record<string, unknown>;
      const sfm = source.data as Record<string, unknown>;

      if (strategy === "authority") {
        // Authority merge using reputation
        const tfmTags = tfm.tags as string[] | undefined;
        const sfmTags = sfm.tags as string[] | undefined;
        const sharedTags = (tfmTags || []).filter((t: string) => (sfmTags || []).includes(t));
        const tfmAuthors = tfm.authors as string[] | undefined;
        const sfmAuthors = sfm.authors as string[] | undefined;
        const targetAuthor = tfmAuthors?.[0] || "anonymous";
        const sourceAuthor = sfmAuthors?.[0] || "anonymous";

        // Look up reputation scores
        const getScore = async (authorDid: string): Promise<number> => {
          const repDir = join(root, REPUTATION_DIR);
          try {
            const repFiles = await readdir(repDir);
            for (const f of repFiles.filter((f) => f.endsWith(".md"))) {
              let data: Record<string, unknown>;
              try {
                const raw = await readFile(join(repDir, f), "utf-8");
                ({ data } = matter(raw));
              } catch {
                continue; // skip corrupted reputation files
              }
              if (data.agentDid !== authorDid) continue;
              let best = 0;
              // Check domain scores for shared tags
              const domainCompetence = data.domainCompetence as
                | Record<string, ReputationDimension>
                | undefined;
              for (const tag of sharedTags) {
                const dim = domainCompetence?.[tag];
                if (dim) {
                  const decayed = computeDecayedScore(dim, now);
                  if (decayed > best) best = decayed;
                }
              }
              // Fallback to reliability
              const dimensions = data.dimensions as Record<string, ReputationDimension> | undefined;
              if (best === 0 && dimensions?.reliability) {
                best = computeDecayedScore(dimensions.reliability, now);
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
      const sfmAuthors = sfm.authors as string[] | undefined;
      let tfmAuthors = tfm.authors as string[] | undefined;
      for (const author of sfmAuthors || []) {
        if (!tfmAuthors?.includes(author)) {
          if (!tfm.authors) tfm.authors = [];
          tfmAuthors = tfm.authors as string[];
          tfmAuthors.push(author);
        }
      }
      if (!tfmAuthors?.includes(did)) {
        if (!tfm.authors) tfm.authors = [];
        tfmAuthors = tfm.authors as string[];
        tfmAuthors.push(did);
      }

      // Union tags
      const sfmTags = sfm.tags as string[] | undefined;
      if (sfmTags) {
        if (!tfm.tags) tfm.tags = [];
        const tfmTags = tfm.tags as string[];
        for (const tag of sfmTags) {
          if (!tfmTags.includes(tag)) tfmTags.push(tag);
        }
      }

      // Confidence: minimum
      if (tfm.confidence !== undefined && sfm.confidence !== undefined) {
        tfm.confidence = Math.min(tfm.confidence as number, sfm.confidence as number);
      } else if (sfm.confidence !== undefined) {
        tfm.confidence = sfm.confidence;
      }

      // Bump version + provenance
      tfm.version = ((tfm.version as number) || 1) + 1;
      tfm.lastModified = nowIso;
      tfm.modifiedBy = did;
      if (!tfm.provenance) tfm.provenance = [];
      (tfm.provenance as unknown[]).push({
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
}
