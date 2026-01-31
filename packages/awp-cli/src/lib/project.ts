import { readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { PROJECTS_DIR } from "@agent-workspace/core";
import type {
  ProjectFrontmatter,
  TaskFrontmatter,
  ProjectMember,
  ReputationDimension,
} from "@agent-workspace/core";
import { parseWorkspaceFile } from "./frontmatter.js";
import type { WorkspaceFile } from "@agent-workspace/core";
import { computeDecayedScore } from "./reputation.js";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Validate a slug
 */
export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/**
 * Get the file path for a project slug
 */
export function slugToProjectPath(
  workspaceRoot: string,
  slug: string
): string {
  return join(workspaceRoot, PROJECTS_DIR, `${slug}.md`);
}

/**
 * Get the tasks directory for a project slug
 */
export function slugToTaskDir(
  workspaceRoot: string,
  projectSlug: string
): string {
  return join(workspaceRoot, PROJECTS_DIR, projectSlug, "tasks");
}

/**
 * Get the file path for a task within a project
 */
export function slugToTaskPath(
  workspaceRoot: string,
  projectSlug: string,
  taskSlug: string
): string {
  return join(workspaceRoot, PROJECTS_DIR, projectSlug, "tasks", `${taskSlug}.md`);
}

/**
 * Load a project by slug
 */
export async function loadProject(
  workspaceRoot: string,
  slug: string
): Promise<WorkspaceFile<ProjectFrontmatter>> {
  const filePath = slugToProjectPath(workspaceRoot, slug);
  return parseWorkspaceFile<ProjectFrontmatter>(filePath);
}

/**
 * List all projects in the workspace
 */
export async function listProjects(
  workspaceRoot: string
): Promise<WorkspaceFile<ProjectFrontmatter>[]> {
  const projDir = join(workspaceRoot, PROJECTS_DIR);
  let entries: string[];
  try {
    entries = await readdir(projDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
  const projects: WorkspaceFile<ProjectFrontmatter>[] = [];

  for (const f of mdFiles) {
    try {
      const parsed = await parseWorkspaceFile<ProjectFrontmatter>(
        join(projDir, f)
      );
      if (parsed.frontmatter.type === "project") {
        projects.push(parsed);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return projects;
}

/**
 * Load a task by project slug and task slug
 */
export async function loadTask(
  workspaceRoot: string,
  projectSlug: string,
  taskSlug: string
): Promise<WorkspaceFile<TaskFrontmatter>> {
  const filePath = slugToTaskPath(workspaceRoot, projectSlug, taskSlug);
  return parseWorkspaceFile<TaskFrontmatter>(filePath);
}

/**
 * List all tasks for a project
 */
export async function listTasks(
  workspaceRoot: string,
  projectSlug: string
): Promise<WorkspaceFile<TaskFrontmatter>[]> {
  const taskDir = slugToTaskDir(workspaceRoot, projectSlug);
  let entries: string[];
  try {
    entries = await readdir(taskDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md")).sort();
  const tasks: WorkspaceFile<TaskFrontmatter>[] = [];

  for (const f of mdFiles) {
    try {
      const parsed = await parseWorkspaceFile<TaskFrontmatter>(
        join(taskDir, f)
      );
      if (parsed.frontmatter.type === "task") {
        tasks.push(parsed);
      }
    } catch {
      // Skip unparseable files
    }
  }

  return tasks;
}

/**
 * Ensure the tasks directory exists for a project
 */
export async function ensureTaskDir(
  workspaceRoot: string,
  projectSlug: string
): Promise<void> {
  const taskDir = slugToTaskDir(workspaceRoot, projectSlug);
  await mkdir(taskDir, { recursive: true });
}

/**
 * Recalculate taskCount and completedCount for a project from its tasks.
 */
export async function computeProjectCounts(
  workspaceRoot: string,
  projectSlug: string
): Promise<{ taskCount: number; completedCount: number }> {
  const tasks = await listTasks(workspaceRoot, projectSlug);
  const taskCount = tasks.length;
  const completedCount = tasks.filter(
    (t) => t.frontmatter.status === "completed"
  ).length;
  return { taskCount, completedCount };
}

/**
 * Check reputation gates for a project member.
 * Returns warnings for any scores below the threshold.
 */
export function checkReputationGates(
  member: ProjectMember,
  dimensions: Record<string, ReputationDimension> | undefined,
  domainCompetence: Record<string, ReputationDimension> | undefined,
  now: Date = new Date()
): { passed: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (!member.minReputation) {
    return { passed: true, warnings };
  }

  for (const [gate, minScore] of Object.entries(member.minReputation)) {
    // Handle domain-competence gates (e.g., "domain-competence:ai-research")
    if (gate.startsWith("domain-competence:")) {
      const domain = gate.slice("domain-competence:".length);
      const dim = domainCompetence?.[domain];
      if (!dim) {
        warnings.push(
          `No domain data for "${domain}" (required: ${minScore})`
        );
        continue;
      }
      const decayed = computeDecayedScore(dim, now);
      if (decayed < minScore) {
        warnings.push(
          `${domain} domain score ${decayed.toFixed(2)} < required ${minScore}`
        );
      }
    } else {
      // Standard dimension gate
      const dim = dimensions?.[gate];
      if (!dim) {
        warnings.push(
          `No data for dimension "${gate}" (required: ${minScore})`
        );
        continue;
      }
      const decayed = computeDecayedScore(dim, now);
      if (decayed < minScore) {
        warnings.push(
          `${gate} score ${decayed.toFixed(2)} < required ${minScore}`
        );
      }
    }
  }

  return { passed: warnings.length === 0, warnings };
}
