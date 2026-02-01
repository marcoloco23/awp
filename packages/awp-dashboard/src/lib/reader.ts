import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import {
  PROJECTS_DIR,
  REPUTATION_DIR,
  ARTIFACTS_DIR,
  CONTRACTS_DIR,
  MEMORY_DIR,
  SYNC_REMOTES_FILE,
  SYNC_STATE_DIR,
  SYNC_CONFLICTS_DIR,
} from "@agent-workspace/core";
import { computeDecayedScore } from "@agent-workspace/utils";
import type {
  IdentityFrontmatter,
  SoulFrontmatter,
  MemoryLongtermFrontmatter,
  WorkspaceManifest,
  ReputationDimension,
} from "@agent-workspace/core";
import type {
  ProjectSummary,
  ProjectDetail,
  TaskSummary,
  ReputationSummary,
  ReputationDetail,
  DimensionSummary,
  ArtifactSummary,
  ArtifactDetail,
  ContractSummary,
  DailyLogSummary,
  WorkspaceHealth,
  WorkspaceStats,
  SocietySummary,
  SocietyDetail,
  SocietyAgentSummary,
  ExperimentListItem,
  CycleDataPoint,
  ReputationTimelineData,
  ExperimentResult,
  SyncRemoteSummary,
  SyncConflictSummary,
  SyncOverview,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getRoot(): string {
  return process.env.AWP_WORKSPACE || process.cwd();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function parseFile<T>(filePath: string): Promise<{ frontmatter: T; body: string } | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const { data, content } = matter(raw);
    return { frontmatter: data as T, body: content.trim() };
  } catch {
    return null;
  }
}

async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const files = await readdir(dir);
    return files.filter((f) => f.endsWith(".md")).sort();
  } catch {
    return [];
  }
}

function dimToSummary(name: string, dim: ReputationDimension, now: Date): DimensionSummary {
  return {
    name,
    score: dim.score,
    decayedScore: computeDecayedScore(dim, now),
    confidence: dim.confidence,
    sampleSize: dim.sampleSize,
    lastSignal: dim.lastSignal,
  };
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------

export async function readManifest(): Promise<WorkspaceManifest | null> {
  const root = getRoot();
  try {
    const raw = await readFile(join(root, ".awp", "workspace.json"), "utf-8");
    return JSON.parse(raw) as WorkspaceManifest;
  } catch {
    return null;
  }
}

export async function readIdentity(): Promise<{ frontmatter: IdentityFrontmatter; body: string } | null> {
  return parseFile<IdentityFrontmatter>(join(getRoot(), "IDENTITY.md"));
}

export async function readSoul(): Promise<{ frontmatter: SoulFrontmatter; body: string } | null> {
  return parseFile<SoulFrontmatter>(join(getRoot(), "SOUL.md"));
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export async function listProjects(statusFilter?: string): Promise<ProjectSummary[]> {
  const root = getRoot();
  const dir = join(root, PROJECTS_DIR);
  const files = await listMdFiles(dir);
  const projects: ProjectSummary[] = [];

  for (const f of files) {
    const parsed = await parseFile<Record<string, unknown>>(join(dir, f));
    if (!parsed || parsed.frontmatter.type !== "project") continue;
    if (statusFilter && parsed.frontmatter.status !== statusFilter) continue;
    const fm = parsed.frontmatter;
    projects.push({
      slug: f.replace(/\.md$/, ""),
      title: (fm.title as string) || f.replace(/\.md$/, ""),
      status: fm.status as ProjectSummary["status"],
      taskCount: (fm.taskCount as number) || 0,
      completedCount: (fm.completedCount as number) || 0,
      deadline: fm.deadline as string | undefined,
      owner: (fm.owner as string) || "unknown",
      memberCount: Array.isArray(fm.members) ? fm.members.length : 0,
      tags: fm.tags as string[] | undefined,
    });
  }
  return projects;
}

export async function readProject(slug: string): Promise<ProjectDetail | null> {
  const root = getRoot();
  const parsed = await parseFile<Record<string, unknown>>(join(root, PROJECTS_DIR, `${slug}.md`));
  if (!parsed) return null;

  const tasks: TaskSummary[] = [];
  const taskDir = join(root, PROJECTS_DIR, slug, "tasks");
  const taskFiles = await listMdFiles(taskDir);

  for (const tf of taskFiles) {
    const tp = await parseFile<Record<string, unknown>>(join(taskDir, tf));
    if (!tp || tp.frontmatter.type !== "task") continue;
    const tfm = tp.frontmatter;
    tasks.push({
      slug: tf.replace(/\.md$/, ""),
      title: (tfm.title as string) || tf.replace(/\.md$/, ""),
      status: tfm.status as TaskSummary["status"],
      assigneeSlug: tfm.assigneeSlug as string | undefined,
      priority: (tfm.priority as TaskSummary["priority"]) || "medium",
      deadline: tfm.deadline as string | undefined,
      blockedBy: (tfm.blockedBy as string[]) || [],
      blocks: (tfm.blocks as string[]) || [],
      tags: tfm.tags as string[] | undefined,
    });
  }

  return {
    frontmatter: parsed.frontmatter as unknown as ProjectDetail["frontmatter"],
    body: parsed.body,
    tasks,
  };
}

// ---------------------------------------------------------------------------
// Reputation
// ---------------------------------------------------------------------------

export async function listReputationProfiles(): Promise<ReputationSummary[]> {
  const root = getRoot();
  const dir = join(root, REPUTATION_DIR);
  const files = await listMdFiles(dir);
  const now = new Date();
  const profiles: ReputationSummary[] = [];

  for (const f of files) {
    const parsed = await parseFile<Record<string, unknown>>(join(dir, f));
    if (!parsed || parsed.frontmatter.type !== "reputation-profile") continue;
    const fm = parsed.frontmatter;

    const dims: DimensionSummary[] = [];
    const dimensionsMap = (fm.dimensions || {}) as Record<string, ReputationDimension>;
    for (const [name, dim] of Object.entries(dimensionsMap)) {
      dims.push(dimToSummary(name, dim, now));
    }

    const domainMap = (fm.domainCompetence || {}) as Record<string, ReputationDimension>;

    profiles.push({
      slug: f.replace(/\.md$/, ""),
      agentName: (fm.agentName as string) || "Unknown",
      agentDid: (fm.agentDid as string) || "",
      signalCount: Array.isArray(fm.signals) ? fm.signals.length : 0,
      dimensions: dims,
      domainCount: Object.keys(domainMap).length,
      lastUpdated: (fm.lastUpdated as string) || "",
    });
  }
  return profiles;
}

export async function readReputationProfile(slug: string): Promise<ReputationDetail | null> {
  const root = getRoot();
  const parsed = await parseFile<Record<string, unknown>>(join(root, REPUTATION_DIR, `${slug}.md`));
  if (!parsed) return null;
  const fm = parsed.frontmatter;
  const now = new Date();

  const dims: DimensionSummary[] = [];
  const dimensionsMap = (fm.dimensions || {}) as Record<string, ReputationDimension>;
  for (const [name, dim] of Object.entries(dimensionsMap)) {
    dims.push(dimToSummary(name, dim, now));
  }

  const domains: DimensionSummary[] = [];
  const domainMap = (fm.domainCompetence || {}) as Record<string, ReputationDimension>;
  for (const [name, dim] of Object.entries(domainMap)) {
    domains.push(dimToSummary(name, dim, now));
  }

  return {
    frontmatter: fm as unknown as ReputationDetail["frontmatter"],
    body: parsed.body,
    dimensions: dims,
    domains,
    signals: (fm.signals as ReputationDetail["signals"]) || [],
  };
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------

export async function listArtifacts(tagFilter?: string): Promise<ArtifactSummary[]> {
  const root = getRoot();
  const dir = join(root, ARTIFACTS_DIR);
  const files = await listMdFiles(dir);
  const artifacts: ArtifactSummary[] = [];

  for (const f of files) {
    const parsed = await parseFile<Record<string, unknown>>(join(dir, f));
    if (!parsed || parsed.frontmatter.type !== "knowledge-artifact") continue;
    const fm = parsed.frontmatter;
    if (tagFilter && !(fm.tags as string[] || []).includes(tagFilter)) continue;
    artifacts.push({
      slug: f.replace(/\.md$/, ""),
      title: (fm.title as string) || f.replace(/\.md$/, ""),
      confidence: fm.confidence as number | undefined,
      version: (fm.version as number) || 1,
      tags: fm.tags as string[] | undefined,
      authors: (fm.authors as string[]) || [],
      created: (fm.created as string) || "",
      lastModified: fm.lastModified as string | undefined,
    });
  }
  return artifacts;
}

export async function readArtifact(slug: string): Promise<ArtifactDetail | null> {
  const root = getRoot();
  const parsed = await parseFile<Record<string, unknown>>(join(root, ARTIFACTS_DIR, `${slug}.md`));
  if (!parsed) return null;
  return {
    frontmatter: parsed.frontmatter as unknown as ArtifactDetail["frontmatter"],
    body: parsed.body,
  };
}

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export async function listContracts(statusFilter?: string): Promise<ContractSummary[]> {
  const root = getRoot();
  const dir = join(root, CONTRACTS_DIR);
  const files = await listMdFiles(dir);
  const contracts: ContractSummary[] = [];

  for (const f of files) {
    const parsed = await parseFile<Record<string, unknown>>(join(dir, f));
    if (!parsed || parsed.frontmatter.type !== "delegation-contract") continue;
    const fm = parsed.frontmatter;
    if (statusFilter && fm.status !== statusFilter) continue;

    const evaluation = fm.evaluation as { result?: Record<string, number>; criteria?: Record<string, number> } | undefined;
    const hasEval = !!evaluation?.result;
    let weightedScore: number | undefined;
    if (hasEval && evaluation?.result && evaluation?.criteria) {
      let totalW = 0;
      let wSum = 0;
      for (const [k, w] of Object.entries(evaluation.criteria)) {
        if (evaluation.result[k] !== undefined) {
          wSum += evaluation.result[k] * w;
          totalW += w;
        }
      }
      if (totalW > 0) weightedScore = Math.round((wSum / totalW) * 100) / 100;
    }

    const task = (fm.task as { description?: string }) || {};
    contracts.push({
      slug: f.replace(/\.md$/, ""),
      status: fm.status as ContractSummary["status"],
      delegator: (fm.delegator as string) || "",
      delegate: (fm.delegate as string) || "",
      delegateSlug: (fm.delegateSlug as string) || "",
      description: task.description || "",
      deadline: fm.deadline as string | undefined,
      created: (fm.created as string) || "",
      hasEvaluation: hasEval,
      weightedScore,
    });
  }
  return contracts;
}

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export async function readMemoryLogs(limit = 14): Promise<DailyLogSummary[]> {
  const root = getRoot();
  const dir = join(root, MEMORY_DIR);
  const files = await listMdFiles(dir);
  const logs: DailyLogSummary[] = [];

  const sorted = files.sort().reverse().slice(0, limit);
  for (const f of sorted) {
    const parsed = await parseFile<Record<string, unknown>>(join(dir, f));
    if (!parsed) continue;
    const fm = parsed.frontmatter;
    const entries = (fm.entries as Array<{ time?: string; content: string; tags?: string[] }>) || [];
    logs.push({
      date: (fm.date as string) || f.replace(/\.md$/, ""),
      entryCount: entries.length,
      entries,
    });
  }
  return logs;
}

export async function readLongTermMemory(): Promise<{ frontmatter: MemoryLongtermFrontmatter; body: string } | null> {
  return parseFile<MemoryLongtermFrontmatter>(join(getRoot(), "MEMORY.md"));
}

// ---------------------------------------------------------------------------
// Health & Stats
// ---------------------------------------------------------------------------

export async function computeWorkspaceHealth(): Promise<WorkspaceHealth> {
  const root = getRoot();
  const warnings: string[] = [];
  const now = new Date();
  const MS_PER_DAY = 86400000;

  if (!(await fileExists(join(root, "IDENTITY.md")))) warnings.push("IDENTITY.md missing");
  if (!(await fileExists(join(root, "SOUL.md")))) warnings.push("SOUL.md missing");
  if (!(await fileExists(join(root, ".awp", "workspace.json")))) warnings.push(".awp/workspace.json missing");

  // Check contract deadlines
  const conDir = join(root, CONTRACTS_DIR);
  for (const f of await listMdFiles(conDir)) {
    const p = await parseFile<Record<string, unknown>>(join(conDir, f));
    if (!p) continue;
    const fm = p.frontmatter;
    if (fm.deadline && (fm.status === "active" || fm.status === "draft")) {
      if (new Date(fm.deadline as string) < now) {
        warnings.push(`Contract "${f.replace(/\.md$/, "")}" is past deadline`);
      }
    }
  }

  // Check reputation decay
  const repDir = join(root, REPUTATION_DIR);
  for (const f of await listMdFiles(repDir)) {
    const p = await parseFile<Record<string, unknown>>(join(repDir, f));
    if (!p) continue;
    const fm = p.frontmatter;
    if (fm.lastUpdated) {
      const days = Math.floor((now.getTime() - new Date(fm.lastUpdated as string).getTime()) / MS_PER_DAY);
      if (days > 30) {
        warnings.push(`${f.replace(/\.md$/, "")} reputation decaying (no signal in ${days} days)`);
      }
    }
  }

  return { ok: warnings.length === 0, warnings };
}

export async function computeStats(): Promise<WorkspaceStats> {
  const projects = await listProjects();
  const artifacts = await listArtifacts();
  const contracts = await listContracts();
  const repProfiles = await listReputationProfiles();
  const memLogs = await readMemoryLogs(999);

  let totalTasks = 0;
  let activeTasks = 0;
  let completedTasks = 0;
  for (const p of projects) {
    totalTasks += p.taskCount;
    completedTasks += p.completedCount;
  }
  // Count active tasks by reading task files
  for (const p of projects) {
    const detail = await readProject(p.slug);
    if (detail) {
      for (const t of detail.tasks) {
        if (t.status === "in-progress" || t.status === "blocked" || t.status === "review") {
          activeTasks++;
        }
      }
    }
  }

  return {
    projects: projects.length,
    tasks: { total: totalTasks, active: activeTasks, completed: completedTasks },
    artifacts: artifacts.length,
    reputationProfiles: repProfiles.length,
    contracts: {
      total: contracts.length,
      active: contracts.filter((c) => c.status === "active").length,
      evaluated: contracts.filter((c) => c.status === "evaluated").length,
    },
    memoryLogs: memLogs.length,
  };
}

// ---------------------------------------------------------------------------
// Societies & Experiments
// ---------------------------------------------------------------------------

const AGENT_COLORS = [
  "var(--accent)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "#a78bfa",
  "#f472b6",
];

function getSocietiesRoot(): string {
  if (process.env.AWP_SOCIETIES) return process.env.AWP_SOCIETIES;
  return join(getRoot(), "..", "societies");
}

export async function listSocieties(statusFilter?: string): Promise<SocietySummary[]> {
  const root = getSocietiesRoot();
  let entries: string[];
  try {
    const all = await readdir(root, { withFileTypes: true });
    entries = all.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }

  const societies: SocietySummary[] = [];
  for (const dir of entries) {
    try {
      const raw = await readFile(join(root, dir, "society.json"), "utf-8");
      const config = JSON.parse(raw);
      if (statusFilter && config.status !== statusFilter) continue;

      let experimentCount = 0;
      try {
        const metricFiles = await readdir(join(root, dir, "metrics"));
        experimentCount = metricFiles.filter((f: string) => f.endsWith(".json")).length;
      } catch {
        /* no metrics dir */
      }

      societies.push({
        id: config.id,
        manifestoId: config.manifestoId,
        status: config.status,
        agentCount: Array.isArray(config.agents) ? config.agents.length : 0,
        currentCycle: config.currentCycle || 0,
        createdAt: config.createdAt,
        experimentCount,
      });
    } catch {
      /* skip directories without valid society.json */
    }
  }

  return societies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function readSocietyDetail(societyId: string): Promise<SocietyDetail | null> {
  const root = getSocietiesRoot();
  const societyDir = join(root, societyId);

  let config;
  try {
    const raw = await readFile(join(societyDir, "society.json"), "utf-8");
    config = JSON.parse(raw);
  } catch {
    return null;
  }

  // Read agent info
  const agents: SocietyAgentSummary[] = [];
  const agentPaths: string[] = config.agents || [];
  for (const agentPath of agentPaths) {
    const agentId = agentPath.split("/").pop() || agentPath;
    const agentDir = join(societyDir, agentId);
    let name = agentId;
    let did = "";

    // Read IDENTITY.md for name
    const identity = await parseFile<Record<string, unknown>>(join(agentDir, "IDENTITY.md"));
    if (identity) {
      name = (identity.frontmatter.name as string) || agentId;
      did = (identity.frontmatter.did as string) || "";
    }

    agents.push({ id: agentId, name, did });
  }

  // Read experiments
  const experiments: ExperimentListItem[] = [];
  try {
    const metricFiles = await readdir(join(societyDir, "metrics"));
    for (const f of metricFiles.filter((mf: string) => mf.endsWith(".json"))) {
      try {
        const raw = await readFile(join(societyDir, "metrics", f), "utf-8");
        const exp: ExperimentResult = JSON.parse(raw);
        experiments.push({
          experimentId: exp.experimentId,
          societyId: exp.societyId,
          startedAt: exp.startedAt,
          endedAt: exp.endedAt,
          totalCycles: exp.totalCycles,
          overallSuccessRate: exp.aggregateMetrics.overallSuccessRate,
          totalTasks: exp.aggregateMetrics.totalTasks,
          totalTokens: exp.aggregateMetrics.totalTokens,
          criteriaMetCount: exp.successCriteriaResults.filter((c) => c.met).length,
          criteriaTotalCount: exp.successCriteriaResults.length,
        });
      } catch {
        /* skip invalid experiment files */
      }
    }
  } catch {
    /* no metrics dir */
  }

  // Attach latest reputation to agents from most recent experiment
  const sortedExps = [...experiments].sort(
    (a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime(),
  );
  if (sortedExps.length > 0) {
    try {
      const latestRaw = await readFile(
        join(societyDir, "metrics", sortedExps[0].experimentId + ".json"),
        "utf-8",
      );
      const latest: ExperimentResult = JSON.parse(latestRaw);
      for (const agent of agents) {
        const did = agent.did;
        if (did && latest.finalReputations[did]) {
          agent.reputation = latest.finalReputations[did];
        }
      }
    } catch {
      /* skip reputation lookup if parse fails */
    }
  }

  return {
    config,
    agents,
    experiments: experiments.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    ),
  };
}

export async function readExperiment(
  societyId: string,
  experimentId: string,
): Promise<ExperimentResult | null> {
  const root = getSocietiesRoot();
  try {
    const raw = await readFile(
      join(root, societyId, "metrics", experimentId + ".json"),
      "utf-8",
    );
    return JSON.parse(raw) as ExperimentResult;
  } catch {
    return null;
  }
}

export function computeCycleDataPoints(experiment: ExperimentResult): CycleDataPoint[] {
  return experiment.cycles.map((c) => ({
    cycle: c.cycleNumber,
    successRate: c.metrics.successRate,
    totalTokens: c.metrics.totalTokens,
    tasksAttempted: c.metrics.tasksAttempted,
    tasksSucceeded: c.metrics.tasksSucceeded,
    tasksFailed: c.metrics.tasksFailed,
  }));
}

// ---------------------------------------------------------------------------
// Sync / Federation
// ---------------------------------------------------------------------------

export async function readSyncOverview(): Promise<SyncOverview> {
  const root = getRoot();
  const remotes: SyncRemoteSummary[] = [];
  let totalArtifactsSynced = 0;
  let totalSignalsSynced = 0;

  // Load remote registry
  try {
    const raw = await readFile(join(root, SYNC_REMOTES_FILE), "utf-8");
    const registry = JSON.parse(raw) as { remotes: Record<string, { url: string; transport: string; added: string; lastSync: string | null }> };

    for (const [name, remote] of Object.entries(registry.remotes)) {
      // Load per-remote sync state
      let trackedArtifacts = 0;
      let signalsSynced = 0;

      try {
        const stateRaw = await readFile(join(root, SYNC_STATE_DIR, `${name}.json`), "utf-8");
        const state = JSON.parse(stateRaw) as { artifacts: Record<string, unknown>; signals: { signalCount: number } };
        trackedArtifacts = Object.keys(state.artifacts).length;
        signalsSynced = state.signals.signalCount;
      } catch {
        /* no state file yet */
      }

      totalArtifactsSynced += trackedArtifacts;
      totalSignalsSynced += signalsSynced;

      remotes.push({
        name,
        url: remote.url,
        transport: remote.transport as SyncRemoteSummary["transport"],
        added: remote.added,
        lastSync: remote.lastSync,
        trackedArtifacts,
        signalsSynced,
      });
    }
  } catch {
    /* no remotes configured */
  }

  // Load conflicts
  const conflicts: SyncConflictSummary[] = [];
  try {
    const conflictFiles = await readdir(join(root, SYNC_CONFLICTS_DIR));
    for (const f of conflictFiles) {
      if (!f.endsWith(".conflict.json")) continue;
      try {
        const raw = await readFile(join(root, SYNC_CONFLICTS_DIR, f), "utf-8");
        const descriptor = JSON.parse(raw) as {
          artifact: string;
          remote: string;
          localVersion: number;
          remoteVersion: number;
          detectedAt: string;
          reason: string;
        };
        conflicts.push({
          artifact: descriptor.artifact,
          remote: descriptor.remote,
          localVersion: descriptor.localVersion,
          remoteVersion: descriptor.remoteVersion,
          detectedAt: descriptor.detectedAt,
          reason: descriptor.reason,
        });
      } catch {
        /* skip invalid conflict files */
      }
    }
  } catch {
    /* no conflicts dir */
  }

  return { remotes, conflicts, totalArtifactsSynced, totalSignalsSynced };
}

export function computeReputationTimeline(experiment: ExperimentResult): ReputationTimelineData {
  // Collect all agent IDs
  const agentIds = Object.keys(experiment.finalReputations);
  const agents = agentIds.map((id, i) => ({
    id,
    name: experiment.finalReputations[id].agentName || id,
    color: AGENT_COLORS[i % AGENT_COLORS.length],
  }));

  // Initialize scores at 0.5 (default starting reputation)
  const currentScores: Record<string, number> = {};
  for (const id of agentIds) {
    currentScores[id] = 50;
  }

  const points: Array<Record<string, number>> = [];

  // Add initial point
  const initialPoint: Record<string, number> = { cycle: 0 };
  for (const id of agentIds) {
    initialPoint[id] = 50;
  }
  points.push(initialPoint);

  // Apply reputation changes cycle by cycle
  for (const cycle of experiment.cycles) {
    for (const change of cycle.reputationChanges) {
      // Update overall score: use newScore averaged across dimensions
      // Since changes come per-dimension, accumulate by computing
      // the average of final dimension scores for the agent
      const agentId = change.agentId;
      if (agentId in currentScores) {
        // delta is per-dimension; approximate overall as shift
        currentScores[agentId] += change.delta * 100;
      }
    }

    const point: Record<string, number> = { cycle: cycle.cycleNumber + 1 };
    for (const id of agentIds) {
      point[id] = Math.round(Math.max(0, Math.min(100, currentScores[id])));
    }
    points.push(point);
  }

  return { points, agents };
}
