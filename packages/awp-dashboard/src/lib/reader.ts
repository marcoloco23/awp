import { readFile, readdir, access } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import {
  PROJECTS_DIR,
  REPUTATION_DIR,
  ARTIFACTS_DIR,
  CONTRACTS_DIR,
  MEMORY_DIR,
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
