/**
 * @agent-workspace/sync
 *
 * Workspace-to-workspace sync for the Agent Workspace Protocol.
 * Enables artifact synchronization and reputation signal sharing
 * between AWP workspaces via pluggable transports.
 */

// Types
export type {
  SyncRemote,
  RemoteRegistry,
  ArtifactSyncWatermark,
  SignalSyncWatermark,
  SyncState,
  SyncTransport,
  ArtifactFilter,
  RemoteWorkspaceInfo,
  RemoteArtifactManifest,
  SyncDiffEntry,
  SyncResult,
  SyncDirection,
  ExportedSignalBatch,
  ExportedSignal,
  ConflictDescriptor,
  SyncOptions,
} from "./types.js";

// Remote registry
export { addRemote, removeRemote, listRemotes, getRemote } from "./remote-registry.js";

// Sync state
export { loadSyncState, saveSyncState, computeArtifactDiff } from "./sync-state.js";

// Sync engine
export { SyncEngine } from "./sync-engine.js";

// Conflict resolution
export { listConflicts, resolveConflict, stashConflict } from "./conflict-resolver.js";

// Transports
export { createTransport } from "./transport/index.js";
export { LocalFsTransport } from "./transport/local-fs.js";
export { GitRemoteTransport } from "./transport/git-remote.js";

// Operations
export { pullArtifacts, pushArtifacts } from "./operations/artifact-sync.js";
export { exportSignals, importSignals } from "./operations/signal-sync.js";
