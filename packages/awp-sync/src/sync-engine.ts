/**
 * Sync engine — orchestrates transport, state, and operations.
 *
 * Provides high-level pull/push/diff APIs that coordinate:
 * - Remote registry lookup
 * - Transport connection
 * - Artifact diff computation
 * - Artifact sync operations
 * - Sync state updates
 */

import { getRemote, touchRemoteSync } from "./remote-registry.js";
import { loadSyncState, saveSyncState, computeArtifactDiff } from "./sync-state.js";
import { createTransport } from "./transport/index.js";
import { scanLocalArtifacts, pullArtifacts, pushArtifacts, buildFilter } from "./operations/artifact-sync.js";
import { exportSignals, importSignals } from "./operations/signal-sync.js";
import type { SyncResult, SyncDiffEntry, SyncOptions, SyncTransport } from "./types.js";

export class SyncEngine {
  constructor(private readonly workspace: string) {}

  /**
   * Compute diff between local and remote artifacts.
   */
  async diff(
    remoteName: string,
    direction: "pull" | "push",
    options?: SyncOptions
  ): Promise<SyncDiffEntry[]> {
    const remote = await getRemote(this.workspace, remoteName);
    if (!remote) throw new Error(`Remote "${remoteName}" not found`);

    const transport = createTransport(remote);
    try {
      await transport.connect(remote);

      const filter = buildFilter(options);
      const [localArtifacts, remoteArtifacts] = await Promise.all([
        scanLocalArtifacts(this.workspace),
        transport.listArtifacts(filter),
      ]);

      // Apply slug filter to local artifacts too
      const filteredLocal = filter?.slugPattern
        ? localArtifacts.filter((a) => {
            const pattern = filter.slugPattern!.replace(/\*/g, ".*");
            return new RegExp(`^${pattern}$`).test(a.slug);
          })
        : localArtifacts;

      const syncState = await loadSyncState(this.workspace, remoteName);
      return computeArtifactDiff(filteredLocal, remoteArtifacts, syncState, direction);
    } finally {
      await transport.disconnect();
    }
  }

  /**
   * Pull artifacts from a remote workspace.
   */
  async pull(remoteName: string, options?: SyncOptions): Promise<SyncResult> {
    const remote = await getRemote(this.workspace, remoteName);
    if (!remote) throw new Error(`Remote "${remoteName}" not found`);

    const transport = createTransport(remote);
    let result: SyncResult;

    try {
      await transport.connect(remote);

      const filter = buildFilter(options);
      const [localArtifacts, remoteArtifacts] = await Promise.all([
        scanLocalArtifacts(this.workspace),
        transport.listArtifacts(filter),
      ]);

      const syncState = await loadSyncState(this.workspace, remoteName);
      const diffEntries = computeArtifactDiff(localArtifacts, remoteArtifacts, syncState, "pull");

      if (options?.dryRun) {
        return {
          remote: remoteName,
          direction: "pull",
          timestamp: new Date().toISOString(),
          imported: diffEntries.filter((e) => e.action === "import").map((e) => e.slug),
          updated: diffEntries.filter((e) => e.action === "fast-forward" || e.action === "merge").map((e) => e.slug),
          conflicts: diffEntries.filter((e) => e.action === "conflict").map((e) => e.slug),
          skipped: diffEntries.filter((e) => e.action === "skip").map((e) => e.slug),
          signalsSynced: 0,
        };
      }

      const { imported, updated, conflicts } = await pullArtifacts(
        this.workspace,
        remoteName,
        transport,
        diffEntries,
        options
      );

      // Update sync state watermarks for successfully synced artifacts
      await this.updateSyncStateAfterPull(remoteName, syncState, diffEntries, localArtifacts, remoteArtifacts, imported, updated);

      // Update remote lastSync timestamp
      await touchRemoteSync(this.workspace, remoteName);

      result = {
        remote: remoteName,
        direction: "pull",
        timestamp: new Date().toISOString(),
        imported,
        updated,
        conflicts,
        skipped: diffEntries.filter((e) => e.action === "skip").map((e) => e.slug),
        signalsSynced: 0,
      };
    } finally {
      await transport.disconnect();
    }

    return result;
  }

  /**
   * Push artifacts to a remote workspace.
   */
  async push(remoteName: string, options?: SyncOptions): Promise<SyncResult> {
    const remote = await getRemote(this.workspace, remoteName);
    if (!remote) throw new Error(`Remote "${remoteName}" not found`);

    const transport = createTransport(remote);
    let result: SyncResult;

    try {
      await transport.connect(remote);

      const filter = buildFilter(options);
      const [localArtifacts, remoteArtifacts] = await Promise.all([
        scanLocalArtifacts(this.workspace),
        transport.listArtifacts(filter),
      ]);

      const filteredLocal = filter?.slugPattern
        ? localArtifacts.filter((a) => {
            const pattern = filter.slugPattern!.replace(/\*/g, ".*");
            return new RegExp(`^${pattern}$`).test(a.slug);
          })
        : localArtifacts;

      const syncState = await loadSyncState(this.workspace, remoteName);
      const diffEntries = computeArtifactDiff(filteredLocal, remoteArtifacts, syncState, "push");

      if (options?.dryRun) {
        return {
          remote: remoteName,
          direction: "push",
          timestamp: new Date().toISOString(),
          imported: [],
          updated: diffEntries.filter((e) => e.action === "push").map((e) => e.slug),
          conflicts: diffEntries.filter((e) => e.action === "conflict").map((e) => e.slug),
          skipped: diffEntries.filter((e) => e.action === "skip").map((e) => e.slug),
          signalsSynced: 0,
        };
      }

      const { pushed, conflicts } = await pushArtifacts(this.workspace, transport, diffEntries);

      // Update sync state for pushed artifacts
      await this.updateSyncStateAfterPush(remoteName, syncState, localArtifacts, remoteArtifacts, pushed);

      await touchRemoteSync(this.workspace, remoteName);

      result = {
        remote: remoteName,
        direction: "push",
        timestamp: new Date().toISOString(),
        imported: [],
        updated: pushed,
        conflicts,
        skipped: diffEntries.filter((e) => e.action === "skip").map((e) => e.slug),
        signalsSynced: 0,
      };
    } finally {
      await transport.disconnect();
    }

    return result;
  }

  /**
   * Pull reputation signals from a remote workspace.
   */
  async pullSignals(remoteName: string, since?: string): Promise<number> {
    const remote = await getRemote(this.workspace, remoteName);
    if (!remote) throw new Error(`Remote "${remoteName}" not found`);

    const transport = createTransport(remote);
    try {
      await transport.connect(remote);

      const syncState = await loadSyncState(this.workspace, remoteName);
      const sinceTimestamp = since || syncState.signals.lastSyncedTimestamp;

      const batch = await transport.readSignalsSince(sinceTimestamp);
      const imported = await importSignals(this.workspace, batch);

      // Update signal sync state
      syncState.signals.lastSyncedTimestamp = batch.exportedAt;
      syncState.signals.signalCount += imported;
      syncState.lastSync = new Date().toISOString();
      await saveSyncState(this.workspace, remoteName, syncState);

      await touchRemoteSync(this.workspace, remoteName);

      return imported;
    } finally {
      await transport.disconnect();
    }
  }

  /**
   * Push reputation signals to a remote workspace.
   * Exports local signals and writes them into the remote workspace.
   */
  async pushSignals(remoteName: string): Promise<number> {
    const remote = await getRemote(this.workspace, remoteName);
    if (!remote) throw new Error(`Remote "${remoteName}" not found`);

    if (remote.transport !== "local-fs") {
      throw new Error("Signal push is currently only supported for local-fs transport");
    }

    const syncState = await loadSyncState(this.workspace, remoteName);
    const batch = await exportSignals(this.workspace, syncState.signals.lastSyncedTimestamp);

    if (batch.signals.length === 0) return 0;

    // Import signals directly into the remote workspace
    const imported = await importSignals(remote.url, batch);

    // Update signal sync state
    syncState.signals.lastSyncedTimestamp = batch.exportedAt;
    syncState.signals.signalCount += imported;
    syncState.lastSync = new Date().toISOString();
    await saveSyncState(this.workspace, remoteName, syncState);

    await touchRemoteSync(this.workspace, remoteName);

    return imported;
  }

  /** Update sync state watermarks after a pull operation */
  private async updateSyncStateAfterPull(
    remoteName: string,
    syncState: ReturnType<typeof loadSyncState> extends Promise<infer T> ? T : never,
    diffEntries: SyncDiffEntry[],
    _localArtifacts: { slug: string; version: number }[],
    remoteArtifacts: { slug: string; version: number }[],
    imported: string[],
    updated: string[]
  ): Promise<void> {
    const remoteMap = new Map(remoteArtifacts.map((a) => [a.slug, a]));
    const synced = new Set([...imported, ...updated]);

    for (const entry of diffEntries) {
      if (!synced.has(entry.slug)) continue;

      const remoteArtifact = remoteMap.get(entry.slug);
      if (!remoteArtifact) continue;

      // After pull: local version = remote version (for import/fast-forward)
      // For merge: local version was incremented by the merge
      syncState.artifacts[entry.slug] = {
        localVersionAtSync: remoteArtifact.version + (entry.action === "merge" ? 1 : 0),
        remoteVersionAtSync: remoteArtifact.version,
        lastSyncedAt: new Date().toISOString(),
      };
    }

    syncState.lastSync = new Date().toISOString();
    await saveSyncState(this.workspace, remoteName, syncState);
  }

  /** Update sync state watermarks after a push operation */
  private async updateSyncStateAfterPush(
    remoteName: string,
    syncState: ReturnType<typeof loadSyncState> extends Promise<infer T> ? T : never,
    localArtifacts: { slug: string; version: number }[],
    _remoteArtifacts: { slug: string; version: number }[],
    pushed: string[]
  ): Promise<void> {
    const localMap = new Map(localArtifacts.map((a) => [a.slug, a]));
    const pushedSet = new Set(pushed);

    for (const slug of pushedSet) {
      const localArtifact = localMap.get(slug);
      if (!localArtifact) continue;

      syncState.artifacts[slug] = {
        localVersionAtSync: localArtifact.version,
        remoteVersionAtSync: localArtifact.version, // After push, remote has our version
        lastSyncedAt: new Date().toISOString(),
      };
    }

    syncState.lastSync = new Date().toISOString();
    await saveSyncState(this.workspace, remoteName, syncState);
  }
}
