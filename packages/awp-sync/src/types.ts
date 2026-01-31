/**
 * Core types for workspace-to-workspace sync.
 */

import type { ReputationSignal } from "@agent-workspace/core";

// ============================================================================
// Remote Registry
// ============================================================================

/** A configured remote workspace */
export interface SyncRemote {
  /** Transport-specific address (filesystem path, git URL, or HTTP URL) */
  url: string;
  /** Which transport adapter to use */
  transport: "local-fs" | "git-remote" | "http";
  /** Remote workspace name (from its workspace.json) */
  workspaceName?: string;
  /** Remote agent DID (optional) */
  agentDid?: string;
  /** Git branch (for git-remote transport) */
  branch?: string;
  /** ISO 8601 timestamp when remote was added */
  added: string;
  /** ISO 8601 timestamp of last successful sync (null if never synced) */
  lastSync: string | null;
}

/** The remotes.json file format */
export interface RemoteRegistry {
  version: number;
  remotes: Record<string, SyncRemote>;
}

// ============================================================================
// Sync State
// ============================================================================

/** Per-artifact sync watermark */
export interface ArtifactSyncWatermark {
  /** Local version at time of last sync */
  localVersionAtSync: number;
  /** Remote version at time of last sync */
  remoteVersionAtSync: number;
  /** ISO 8601 timestamp of last sync for this artifact */
  lastSyncedAt: string;
}

/** Reputation signal sync watermark */
export interface SignalSyncWatermark {
  /** ISO 8601 timestamp of newest signal synced */
  lastSyncedTimestamp: string;
  /** Total signals synced to date */
  signalCount: number;
}

/** Per-remote sync state file format */
export interface SyncState {
  version: number;
  remote: string;
  lastSync: string;
  artifacts: Record<string, ArtifactSyncWatermark>;
  signals: SignalSyncWatermark;
}

// ============================================================================
// Transport
// ============================================================================

/** Basic info about a remote workspace */
export interface RemoteWorkspaceInfo {
  workspaceName: string;
  agentDid?: string;
  awpVersion: string;
}

/** Artifact manifest (frontmatter-only, no body) */
export interface RemoteArtifactManifest {
  slug: string;
  version: number;
  lastModified: string;
  confidence?: number;
  tags?: string[];
  authors: string[];
}

/** Filter for listing artifacts */
export interface ArtifactFilter {
  /** Glob pattern for slug matching (e.g., "llm-*") */
  slugPattern?: string;
  /** Filter by tags */
  tags?: string[];
  /** Only artifacts modified after this ISO 8601 timestamp */
  since?: string;
}

/**
 * Transport interface for reading/writing to a remote workspace.
 * Implementations: LocalFsTransport, GitRemoteTransport
 */
export interface SyncTransport {
  /** Validate and connect to the remote workspace */
  connect(remote: SyncRemote): Promise<RemoteWorkspaceInfo>;
  /** List artifacts on the remote, optionally filtered */
  listArtifacts(filter?: ArtifactFilter): Promise<RemoteArtifactManifest[]>;
  /** Read a full artifact file (frontmatter + body) from remote */
  readArtifact(slug: string): Promise<{ frontmatter: Record<string, unknown>; content: string; raw: string }>;
  /** Write a full artifact file to remote */
  writeArtifact(slug: string, content: string): Promise<void>;
  /** Read reputation signals from remote since a timestamp */
  readSignalsSince(since: string): Promise<ExportedSignalBatch>;
  /** Write reputation signals to remote */
  writeSignals(batch: ExportedSignalBatch): Promise<void>;
  /** Disconnect and cleanup (e.g., remove temp clone) */
  disconnect(): Promise<void>;
}

// ============================================================================
// Sync Operations
// ============================================================================

export type SyncDirection = "pull" | "push";

/** Result of comparing one artifact between local and remote */
export interface SyncDiffEntry {
  slug: string;
  action: "import" | "fast-forward" | "merge" | "conflict" | "skip" | "push";
  localVersion: number | null;
  remoteVersion: number;
  reason: string;
}

/** Result of a sync operation */
export interface SyncResult {
  remote: string;
  direction: SyncDirection;
  timestamp: string;
  imported: string[];
  updated: string[];
  conflicts: string[];
  skipped: string[];
  signalsSynced: number;
}

/** Options for pull/push operations */
export interface SyncOptions {
  /** Filter by slug pattern */
  slugPattern?: string;
  /** Filter by tag */
  tag?: string;
  /** Merge strategy for conflicts */
  strategy?: "additive" | "authority";
  /** If true, show what would change without applying */
  dryRun?: boolean;
  /** If true, never auto-merge — always create conflict files */
  noAutoMerge?: boolean;
}

// ============================================================================
// Reputation Signal Export
// ============================================================================

/** A single signal with subject identification for cross-workspace sharing */
export interface ExportedSignal {
  /** The subject agent DID (who the signal is about) */
  subjectDid: string;
  /** The subject agent name */
  subjectName: string;
  /** The original reputation signal */
  signal: ReputationSignal;
}

/** Batch of exported signals for sync */
export interface ExportedSignalBatch {
  /** Source workspace name */
  sourceWorkspace: string;
  /** Source agent DID */
  sourceAgentDid: string;
  /** ISO 8601 export timestamp */
  exportedAt: string;
  /** The signals */
  signals: ExportedSignal[];
}

// ============================================================================
// Conflict Resolution
// ============================================================================

/** Descriptor for a pending sync conflict */
export interface ConflictDescriptor {
  /** Artifact slug */
  artifact: string;
  /** Remote name */
  remote: string;
  /** Local version number */
  localVersion: number;
  /** Remote version number */
  remoteVersion: number;
  /** ISO 8601 when conflict was detected */
  detectedAt: string;
  /** Merge strategy that was attempted */
  strategy: string;
  /** Why the conflict occurred */
  reason: string;
  /** Path to local artifact */
  localPath: string;
  /** Path to stashed remote copy */
  remoteCopyPath: string;
}
