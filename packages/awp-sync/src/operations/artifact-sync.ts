/**
 * Artifact sync operations.
 *
 * Handles the actual import, fast-forward, merge, and push of artifacts
 * between local and remote workspaces.
 */

import { readFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { ARTIFACTS_DIR } from "@agent-workspace/core";
import { atomicWriteFile, withFileLock, loadJsonFile } from "@agent-workspace/utils";
import type { SyncTransport, SyncDiffEntry, ArtifactFilter, SyncOptions } from "../types.js";
import type { LocalArtifactInfo } from "../sync-state.js";
import { stashConflict } from "../conflict-resolver.js";

/**
 * Scan local artifacts directory and return version info.
 */
export async function scanLocalArtifacts(workspace: string): Promise<LocalArtifactInfo[]> {
  const artifactsDir = join(workspace, ARTIFACTS_DIR);
  const artifacts: LocalArtifactInfo[] = [];

  let files: string[];
  try {
    files = await readdir(artifactsDir);
  } catch {
    return [];
  }

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const slug = file.replace(/\.md$/, "");

    try {
      const raw = await readFile(join(artifactsDir, file), "utf-8");
      const { data } = matter(raw);
      artifacts.push({
        slug,
        version: (data.version as number) || 1,
        lastModified: (data.lastModified as string) || (data.created as string) || "",
      });
    } catch {
      // Skip unparseable files
    }
  }

  return artifacts;
}

/**
 * Build an ArtifactFilter from SyncOptions.
 */
export function buildFilter(options?: SyncOptions): ArtifactFilter | undefined {
  if (!options?.slugPattern && !options?.tag) return undefined;
  return {
    slugPattern: options.slugPattern,
    tags: options.tag ? [options.tag] : undefined,
  };
}

/**
 * Pull artifacts from a remote workspace based on computed diff entries.
 *
 * Returns arrays of imported, updated, and conflicted slugs.
 */
export async function pullArtifacts(
  workspace: string,
  remoteName: string,
  transport: SyncTransport,
  diffEntries: SyncDiffEntry[],
  options?: SyncOptions
): Promise<{ imported: string[]; updated: string[]; conflicts: string[] }> {
  const imported: string[] = [];
  const updated: string[] = [];
  const conflicts: string[] = [];

  const artifactsDir = join(workspace, ARTIFACTS_DIR);
  await mkdir(artifactsDir, { recursive: true });

  // Get workspace info for sync provenance
  const manifestPath = join(workspace, ".awp/workspace.json");
  const manifest = await loadJsonFile<Record<string, unknown>>(manifestPath);
  const agentDid = (manifest?.agent as Record<string, string>)?.did || "unknown";

  for (const entry of diffEntries) {
    if (entry.action === "skip") continue;

    if (entry.action === "import" || entry.action === "fast-forward") {
      // Read from remote
      const remote = await transport.readArtifact(entry.slug);

      // Add synced provenance entry
      const frontmatter = remote.frontmatter;
      if (!frontmatter.provenance) frontmatter.provenance = [];
      (frontmatter.provenance as unknown[]).push({
        agent: agentDid,
        action: "synced",
        timestamp: new Date().toISOString(),
        message: `Pulled from ${remoteName} (remote version ${entry.remoteVersion})`,
        syncSource: remoteName,
      });

      const output = matter.stringify(remote.content, frontmatter);
      const localPath = join(artifactsDir, `${entry.slug}.md`);

      await withFileLock(localPath, async () => {
        await atomicWriteFile(localPath, output);
      });

      if (entry.action === "import") {
        imported.push(entry.slug);
      } else {
        updated.push(entry.slug);
      }
    } else if (entry.action === "merge") {
      if (options?.noAutoMerge) {
        // Stash as conflict
        const remote = await transport.readArtifact(entry.slug);
        await stashConflict(
          workspace,
          entry.slug,
          remoteName,
          entry.localVersion!,
          entry.remoteVersion,
          remote.raw,
          options?.strategy || "additive",
          entry.reason
        );
        conflicts.push(entry.slug);
        continue;
      }

      // Auto-merge using additive strategy
      const remote = await transport.readArtifact(entry.slug);
      const localPath = join(artifactsDir, `${entry.slug}.md`);

      await withFileLock(localPath, async () => {
        const localRaw = await readFile(localPath, "utf-8");
        const local = matter(localRaw);

        // Additive merge: append remote body to local with separator
        const separator = `\n\n---\n_Synced from ${remoteName} (version ${entry.remoteVersion})_\n\n`;
        local.content = local.content + separator + remote.content;

        // Merge authors
        const localAuthors = (local.data.authors as string[]) || [];
        const remoteAuthors = (remote.frontmatter.authors as string[]) || [];
        const mergedAuthors = [...new Set([...localAuthors, ...remoteAuthors])];
        local.data.authors = mergedAuthors;

        // Increment version
        local.data.version = ((local.data.version as number) || 1) + 1;
        local.data.lastModified = new Date().toISOString();
        local.data.modifiedBy = agentDid;

        // Add synced provenance
        if (!local.data.provenance) local.data.provenance = [];
        (local.data.provenance as unknown[]).push({
          agent: agentDid,
          action: "synced",
          timestamp: new Date().toISOString(),
          message: `Merged from ${remoteName} (remote version ${entry.remoteVersion})`,
          syncSource: remoteName,
        });

        const output = matter.stringify(local.content, local.data);
        await atomicWriteFile(localPath, output);
      });

      updated.push(entry.slug);
    } else if (entry.action === "conflict") {
      // Unresolvable conflict — stash remote copy
      const remote = await transport.readArtifact(entry.slug);
      await stashConflict(
        workspace,
        entry.slug,
        remoteName,
        entry.localVersion!,
        entry.remoteVersion,
        remote.raw,
        options?.strategy || "additive",
        entry.reason
      );
      conflicts.push(entry.slug);
    }
  }

  return { imported, updated, conflicts };
}

/**
 * Push artifacts to a remote workspace based on computed diff entries.
 *
 * Returns array of pushed slugs.
 */
export async function pushArtifacts(
  workspace: string,
  transport: SyncTransport,
  diffEntries: SyncDiffEntry[]
): Promise<{ pushed: string[]; conflicts: string[] }> {
  const pushed: string[] = [];
  const conflicts: string[] = [];

  for (const entry of diffEntries) {
    if (entry.action === "skip") continue;

    if (entry.action === "push") {
      const localPath = join(workspace, ARTIFACTS_DIR, `${entry.slug}.md`);
      const content = await readFile(localPath, "utf-8");
      await transport.writeArtifact(entry.slug, content);
      pushed.push(entry.slug);
    } else if (entry.action === "conflict") {
      conflicts.push(entry.slug);
    }
  }

  return { pushed, conflicts };
}
