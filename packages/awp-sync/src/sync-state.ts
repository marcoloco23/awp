/**
 * Sync state tracking.
 *
 * Maintains per-remote watermarks in .awp/sync/state/<remote>.json
 * to enable incremental sync and three-way conflict detection.
 */

import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { SYNC_STATE_DIR } from "@agent-workspace/core";
import { safeWriteJson, loadJsonFile, withFileLock } from "@agent-workspace/utils";
import type {
  SyncState,
  ArtifactSyncWatermark,
  SyncDiffEntry,
  RemoteArtifactManifest,
} from "./types.js";

/** Local artifact info for diff computation */
export interface LocalArtifactInfo {
  slug: string;
  version: number;
  lastModified: string;
}

/** Compute the state file path for a remote */
function stateFilePath(workspace: string, remoteName: string): string {
  return join(workspace, SYNC_STATE_DIR, `${remoteName}.json`);
}

/**
 * Load sync state for a remote. Returns empty state if none exists.
 */
export async function loadSyncState(workspace: string, remoteName: string): Promise<SyncState> {
  const filePath = stateFilePath(workspace, remoteName);
  const data = await loadJsonFile<SyncState>(filePath);
  return (
    data ?? {
      version: 1,
      remote: remoteName,
      lastSync: new Date(0).toISOString(),
      artifacts: {},
      signals: { lastSyncedTimestamp: new Date(0).toISOString(), signalCount: 0 },
    }
  );
}

/**
 * Save sync state for a remote.
 */
export async function saveSyncState(
  workspace: string,
  remoteName: string,
  state: SyncState
): Promise<void> {
  const stateDir = join(workspace, SYNC_STATE_DIR);
  await mkdir(stateDir, { recursive: true });
  const filePath = stateFilePath(workspace, remoteName);

  await withFileLock(filePath, async () => {
    await safeWriteJson(filePath, state);
  });
}

/**
 * Compute artifact diff between local workspace and remote.
 *
 * Uses three-way comparison:
 * - localVersionAtSync vs current local version → local changed?
 * - remoteVersionAtSync vs current remote version → remote changed?
 *
 * Returns a list of diff entries with recommended actions.
 */
export function computeArtifactDiff(
  localArtifacts: LocalArtifactInfo[],
  remoteArtifacts: RemoteArtifactManifest[],
  syncState: SyncState,
  direction: "pull" | "push"
): SyncDiffEntry[] {
  const entries: SyncDiffEntry[] = [];

  const localMap = new Map(localArtifacts.map((a) => [a.slug, a]));
  const remoteMap = new Map(remoteArtifacts.map((a) => [a.slug, a]));

  if (direction === "pull") {
    // For each remote artifact, determine what action to take locally
    for (const remote of remoteArtifacts) {
      const local = localMap.get(remote.slug);
      const watermark = syncState.artifacts[remote.slug];

      if (!local) {
        // Artifact doesn't exist locally — import it
        entries.push({
          slug: remote.slug,
          action: "import",
          localVersion: null,
          remoteVersion: remote.version,
          reason: "New artifact from remote",
        });
        continue;
      }

      if (!watermark) {
        // Artifact exists locally but has never been synced — conflict
        entries.push({
          slug: remote.slug,
          action: local.version === remote.version ? "skip" : "conflict",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: local.version === remote.version
            ? "Same version, never synced"
            : "Both exist, never synced — cannot determine lineage",
        });
        continue;
      }

      const localChanged = local.version > watermark.localVersionAtSync;
      const remoteChanged = remote.version > watermark.remoteVersionAtSync;

      if (!localChanged && !remoteChanged) {
        entries.push({
          slug: remote.slug,
          action: "skip",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: "No changes since last sync",
        });
      } else if (!localChanged && remoteChanged) {
        entries.push({
          slug: remote.slug,
          action: "fast-forward",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: "Remote updated, local unchanged",
        });
      } else if (localChanged && !remoteChanged) {
        entries.push({
          slug: remote.slug,
          action: "skip",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: "Local updated, remote unchanged (push candidate)",
        });
      } else {
        // Both changed
        entries.push({
          slug: remote.slug,
          action: "merge",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: "Both local and remote modified since last sync",
        });
      }
    }
  } else {
    // Push direction: for each local artifact, determine if it should be pushed
    for (const local of localArtifacts) {
      const remote = remoteMap.get(local.slug);
      const watermark = syncState.artifacts[local.slug];

      if (!remote) {
        // Artifact doesn't exist on remote — push it
        entries.push({
          slug: local.slug,
          action: "push",
          localVersion: local.version,
          remoteVersion: 0,
          reason: "New artifact, not on remote",
        });
        continue;
      }

      if (!watermark) {
        // Both exist but never synced
        entries.push({
          slug: local.slug,
          action: local.version === remote.version ? "skip" : "conflict",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: local.version === remote.version
            ? "Same version, never synced"
            : "Both exist, never synced — cannot determine lineage",
        });
        continue;
      }

      const localChanged = local.version > watermark.localVersionAtSync;
      const remoteChanged = remote.version > watermark.remoteVersionAtSync;

      if (!localChanged && !remoteChanged) {
        entries.push({
          slug: local.slug,
          action: "skip",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: "No changes since last sync",
        });
      } else if (localChanged && !remoteChanged) {
        entries.push({
          slug: local.slug,
          action: "push",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: "Local updated, remote unchanged",
        });
      } else if (!localChanged && remoteChanged) {
        entries.push({
          slug: local.slug,
          action: "skip",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: "Remote updated, local unchanged (pull candidate)",
        });
      } else {
        entries.push({
          slug: local.slug,
          action: "conflict",
          localVersion: local.version,
          remoteVersion: remote.version,
          reason: "Both local and remote modified since last sync",
        });
      }
    }
  }

  return entries;
}
