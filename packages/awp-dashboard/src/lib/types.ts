import type {
  ProjectFrontmatter,
  TaskFrontmatter,
  ReputationProfileFrontmatter,
  ReputationDimension,
  ReputationSignal,
  ArtifactFrontmatter,
  DelegationContractFrontmatter,
  IdentityFrontmatter,
  SoulFrontmatter,
  MemoryDailyFrontmatter,
  MemoryLongtermFrontmatter,
  WorkspaceManifest,
} from "@agent-workspace/core";

// Re-export for convenience
export type {
  ProjectFrontmatter,
  TaskFrontmatter,
  ReputationProfileFrontmatter,
  ReputationDimension,
  ReputationSignal,
  ArtifactFrontmatter,
  DelegationContractFrontmatter,
  IdentityFrontmatter,
  SoulFrontmatter,
  MemoryDailyFrontmatter,
  MemoryLongtermFrontmatter,
  WorkspaceManifest,
};

export interface ProjectSummary {
  slug: string;
  title: string;
  status: ProjectFrontmatter["status"];
  taskCount: number;
  completedCount: number;
  deadline?: string;
  owner: string;
  memberCount: number;
  tags?: string[];
}

export interface TaskSummary {
  slug: string;
  title: string;
  status: TaskFrontmatter["status"];
  assigneeSlug?: string;
  priority: TaskFrontmatter["priority"];
  deadline?: string;
  blockedBy: string[];
  blocks: string[];
  tags?: string[];
}

export interface ProjectDetail {
  frontmatter: ProjectFrontmatter;
  body: string;
  tasks: TaskSummary[];
}

export interface DimensionSummary {
  name: string;
  score: number;
  decayedScore: number;
  confidence: number;
  sampleSize: number;
  lastSignal: string;
}

export interface ReputationSummary {
  slug: string;
  agentName: string;
  agentDid: string;
  signalCount: number;
  dimensions: DimensionSummary[];
  domainCount: number;
  lastUpdated: string;
}

export interface ReputationDetail {
  frontmatter: ReputationProfileFrontmatter;
  body: string;
  dimensions: DimensionSummary[];
  domains: DimensionSummary[];
  signals: ReputationSignal[];
}

export interface ArtifactSummary {
  slug: string;
  title: string;
  confidence?: number;
  version: number;
  tags?: string[];
  authors: string[];
  created: string;
  lastModified?: string;
}

export interface ArtifactDetail {
  frontmatter: ArtifactFrontmatter;
  body: string;
}

export interface ContractSummary {
  slug: string;
  status: DelegationContractFrontmatter["status"];
  delegator: string;
  delegate: string;
  delegateSlug: string;
  description: string;
  deadline?: string;
  created: string;
  hasEvaluation: boolean;
  weightedScore?: number;
}

export interface DailyLogSummary {
  date: string;
  entryCount: number;
  entries: Array<{ time?: string; content: string; tags?: string[] }>;
}

export interface WorkspaceHealth {
  ok: boolean;
  warnings: string[];
}

export interface WorkspaceStats {
  projects: number;
  tasks: { total: number; active: number; completed: number };
  artifacts: number;
  reputationProfiles: number;
  contracts: { total: number; active: number; evaluated: number };
  memoryLogs: number;
}

// ── Experiment / Society types ───────────────────────────────────────────────

export type {
  SocietyConfig,
  ExperimentResult,
  CycleResult,
  CycleMetrics,
  AgentReputation,
} from "@agent-workspace/agent";

export interface SocietySummary {
  id: string;
  manifestoId: string;
  status: "active" | "paused" | "archived";
  agentCount: number;
  currentCycle: number;
  createdAt: string;
  experimentCount: number;
}

export interface SocietyAgentSummary {
  id: string;
  name: string;
  did: string;
  reputation?: import("@agent-workspace/agent").AgentReputation;
}

export interface ExperimentListItem {
  experimentId: string;
  societyId: string;
  startedAt: string;
  endedAt: string;
  totalCycles: number;
  overallSuccessRate: number;
  totalTasks: number;
  totalTokens: number;
  criteriaMetCount: number;
  criteriaTotalCount: number;
}

export interface SocietyDetail {
  config: import("@agent-workspace/agent").SocietyConfig;
  agents: SocietyAgentSummary[];
  experiments: ExperimentListItem[];
}

export interface CycleDataPoint {
  cycle: number;
  successRate: number;
  totalTokens: number;
  tasksAttempted: number;
  tasksSucceeded: number;
  tasksFailed: number;
}

export interface ReputationTimelineData {
  points: Array<Record<string, number>>;
  agents: Array<{ id: string; name: string; color: string }>;
}

// ── Sync / Federation types ──────────────────────────────────────────────────

export interface SyncRemoteSummary {
  name: string;
  url: string;
  transport: "local-fs" | "git-remote" | "http";
  added: string;
  lastSync: string | null;
  trackedArtifacts: number;
  signalsSynced: number;
}

export interface SyncConflictSummary {
  artifact: string;
  remote: string;
  localVersion: number;
  remoteVersion: number;
  detectedAt: string;
  reason: string;
}

export interface SyncOverview {
  remotes: SyncRemoteSummary[];
  conflicts: SyncConflictSummary[];
  totalArtifactsSynced: number;
  totalSignalsSynced: number;
}
