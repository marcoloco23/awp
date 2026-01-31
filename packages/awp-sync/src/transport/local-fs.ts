/**
 * Local filesystem transport.
 *
 * Reads/writes directly to a local filesystem path. Covers the primary use
 * case of syncing between workspaces on the same machine.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import { MANIFEST_PATH, ARTIFACTS_DIR, REPUTATION_DIR } from "@agent-workspace/core";
import { atomicWriteFile, withFileLock, loadJsonFile } from "@agent-workspace/utils";
import type {
  SyncTransport,
  SyncRemote,
  RemoteWorkspaceInfo,
  RemoteArtifactManifest,
  ArtifactFilter,
  ExportedSignalBatch,
} from "../types.js";

export class LocalFsTransport implements SyncTransport {
  private remotePath = "";

  async connect(remote: SyncRemote): Promise<RemoteWorkspaceInfo> {
    this.remotePath = remote.url;

    // Verify the remote is a valid AWP workspace
    const manifestPath = join(this.remotePath, MANIFEST_PATH);
    const manifest = await loadJsonFile<Record<string, unknown>>(manifestPath);

    if (!manifest) {
      throw new Error(`Not a valid AWP workspace: ${remote.url} (no ${MANIFEST_PATH})`);
    }

    return {
      workspaceName: (manifest.name as string) || "unknown",
      agentDid: (manifest.agent as Record<string, string>)?.did,
      awpVersion: (manifest.awp as string) || "unknown",
    };
  }

  async listArtifacts(filter?: ArtifactFilter): Promise<RemoteArtifactManifest[]> {
    const artifactsDir = join(this.remotePath, ARTIFACTS_DIR);
    const manifests: RemoteArtifactManifest[] = [];

    let files: string[];
    try {
      files = await readdir(artifactsDir);
    } catch {
      return []; // No artifacts directory
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      const slug = file.replace(/\.md$/, "");

      // Apply slug filter
      if (filter?.slugPattern) {
        const pattern = filter.slugPattern.replace(/\*/g, ".*");
        if (!new RegExp(`^${pattern}$`).test(slug)) continue;
      }

      try {
        const raw = await readFile(join(artifactsDir, file), "utf-8");
        const { data } = matter(raw);

        // Apply tag filter
        if (filter?.tags && filter.tags.length > 0) {
          const artifactTags = (data.tags as string[]) || [];
          if (!filter.tags.some((t) => artifactTags.includes(t))) continue;
        }

        // Apply since filter
        if (filter?.since && data.lastModified) {
          if (new Date(data.lastModified as string) <= new Date(filter.since)) continue;
        }

        manifests.push({
          slug,
          version: (data.version as number) || 1,
          lastModified: (data.lastModified as string) || (data.created as string) || "",
          confidence: data.confidence as number | undefined,
          tags: data.tags as string[] | undefined,
          authors: (data.authors as string[]) || [],
        });
      } catch {
        // Skip unparseable files
      }
    }

    return manifests;
  }

  async readArtifact(
    slug: string
  ): Promise<{ frontmatter: Record<string, unknown>; content: string; raw: string }> {
    const filePath = join(this.remotePath, ARTIFACTS_DIR, `${slug}.md`);
    const raw = await readFile(filePath, "utf-8");
    const { data, content } = matter(raw);
    return { frontmatter: data, content, raw };
  }

  async writeArtifact(slug: string, content: string): Promise<void> {
    const filePath = join(this.remotePath, ARTIFACTS_DIR, `${slug}.md`);
    await withFileLock(filePath, async () => {
      await atomicWriteFile(filePath, content);
    });
  }

  async readSignalsSince(since: string): Promise<ExportedSignalBatch> {
    const repDir = join(this.remotePath, REPUTATION_DIR);
    const sinceDate = new Date(since);
    const signals: ExportedSignalBatch["signals"] = [];

    // Read workspace manifest for source info
    const manifestPath = join(this.remotePath, MANIFEST_PATH);
    const manifest = await loadJsonFile<Record<string, unknown>>(manifestPath);
    const agentInfo = manifest?.agent as Record<string, string> | undefined;

    let files: string[];
    try {
      files = await readdir(repDir);
    } catch {
      return {
        sourceWorkspace: (manifest?.name as string) || "unknown",
        sourceAgentDid: agentInfo?.did || "unknown",
        exportedAt: new Date().toISOString(),
        signals: [],
      };
    }

    for (const file of files) {
      if (!file.endsWith(".md")) continue;

      try {
        const raw = await readFile(join(repDir, file), "utf-8");
        const { data } = matter(raw);

        const profileSignals = (data.signals as Array<Record<string, unknown>>) || [];
        const subjectDid = data.agentDid as string;
        const subjectName = data.agentName as string;

        for (const sig of profileSignals) {
          const sigTimestamp = new Date(sig.timestamp as string);
          if (sigTimestamp > sinceDate) {
            signals.push({
              subjectDid,
              subjectName,
              signal: {
                source: sig.source as string,
                dimension: sig.dimension as string,
                domain: sig.domain as string | undefined,
                score: sig.score as number,
                timestamp: sig.timestamp as string,
                evidence: sig.evidence as string | undefined,
                message: sig.message as string | undefined,
              },
            });
          }
        }
      } catch {
        // Skip unparseable profiles
      }
    }

    return {
      sourceWorkspace: (manifest?.name as string) || "unknown",
      sourceAgentDid: agentInfo?.did || "unknown",
      exportedAt: new Date().toISOString(),
      signals,
    };
  }

  async writeSignals(_batch: ExportedSignalBatch): Promise<void> {
    // Writing signals to a remote is handled by the signal-sync operation
    // which imports them into the appropriate reputation profiles.
    // For local-fs, this is a no-op on the transport level — the caller
    // handles the actual profile updates.
    throw new Error(
      "Use importSignals() from operations/signal-sync.ts to import signals into a workspace"
    );
  }

  async disconnect(): Promise<void> {
    // No cleanup needed for local-fs
    this.remotePath = "";
  }
}
