import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import {
  validateSlug,
  slugToProjectPath,
  slugToTaskDir,
  slugToTaskPath,
  loadProject,
  listProjects,
  loadTask,
  listTasks,
  ensureTaskDir,
  computeProjectCounts,
  checkReputationGates,
} from "./project.js";
import type {
  ProjectFrontmatter,
  TaskFrontmatter,
  ReputationDimension,
} from "@agent-workspace/core";

const NOW = new Date("2026-05-12T00:00:00Z");

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-cli-p-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, "projects"), { recursive: true });
  return dir;
}

function buildProject(slug: string, overrides: Partial<ProjectFrontmatter> = {}): string {
  const fm: ProjectFrontmatter = {
    awp: "1.0.0",
    cdp: "1.0.0",
    type: "project",
    id: `project:${slug}`,
    title: slug,
    status: "active",
    owner: "did:awp:a",
    created: NOW.toISOString(),
    members: [],
    taskCount: 0,
    completedCount: 0,
    ...overrides,
  };
  return matter.stringify("\n# Project\n", fm as unknown as Record<string, unknown>);
}

function buildTask(projectSlug: string, taskSlug: string, status: TaskFrontmatter["status"] = "pending"): string {
  const fm: TaskFrontmatter = {
    awp: "1.0.0",
    cdp: "1.0.0",
    type: "task",
    id: `task:${projectSlug}/${taskSlug}`,
    projectId: `project:${projectSlug}`,
    title: taskSlug,
    status,
    priority: "medium",
    created: NOW.toISOString(),
    blockedBy: [],
    blocks: [],
  };
  return matter.stringify("\n# Task\n", fm as unknown as Record<string, unknown>);
}

describe("validateSlug / path helpers", () => {
  it("validates slugs", () => {
    expect(validateSlug("ok")).toBe(true);
    expect(validateSlug("Bad")).toBe(false);
  });
  it("slugToProjectPath", () => {
    expect(slugToProjectPath("/w", "p")).toBe(join("/w", "projects", "p.md"));
  });
  it("slugToTaskDir + slugToTaskPath", () => {
    expect(slugToTaskDir("/w", "p")).toBe(join("/w", "projects", "p", "tasks"));
    expect(slugToTaskPath("/w", "p", "t")).toBe(join("/w", "projects", "p", "tasks", "t.md"));
  });
});

describe("loadProject + listProjects", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("loads a project from disk", async () => {
    await writeFile(join(root, "projects", "p.md"), buildProject("p"));
    const p = await loadProject(root, "p");
    expect(p.frontmatter.id).toBe("project:p");
  });

  it("lists only type=project files", async () => {
    await writeFile(join(root, "projects", "a.md"), buildProject("a"));
    await writeFile(
      join(root, "projects", "note.md"),
      matter.stringify("\n# Note\n", { awp: "1.0.0", type: "other" }),
    );
    const list = await listProjects(root);
    expect(list).toHaveLength(1);
    expect(list[0].frontmatter.id).toBe("project:a");
  });

  it("returns empty when no projects dir", async () => {
    await rm(join(root, "projects"), { recursive: true });
    expect(await listProjects(root)).toEqual([]);
  });
});

describe("tasks", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
    await mkdir(join(root, "projects", "p", "tasks"), { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("ensureTaskDir creates the dir", async () => {
    await ensureTaskDir(root, "newproj");
    const list = await listTasks(root, "newproj");
    expect(list).toEqual([]);
  });

  it("loadTask + listTasks", async () => {
    await writeFile(join(root, "projects", "p", "tasks", "t.md"), buildTask("p", "t"));
    const t = await loadTask(root, "p", "t");
    expect(t.frontmatter.id).toBe("task:p/t");
    const all = await listTasks(root, "p");
    expect(all).toHaveLength(1);
  });

  it("computeProjectCounts tallies completed tasks", async () => {
    await writeFile(join(root, "projects", "p", "tasks", "a.md"), buildTask("p", "a", "completed"));
    await writeFile(join(root, "projects", "p", "tasks", "b.md"), buildTask("p", "b", "pending"));
    await writeFile(join(root, "projects", "p", "tasks", "c.md"), buildTask("p", "c", "completed"));
    const counts = await computeProjectCounts(root, "p");
    expect(counts.taskCount).toBe(3);
    expect(counts.completedCount).toBe(2);
  });
});

describe("checkReputationGates", () => {
  const dim = (score: number): ReputationDimension => ({
    score,
    confidence: 0.5,
    sampleSize: 10,
    lastSignal: NOW.toISOString(),
  });

  it("passes when no minReputation is set", () => {
    const r = checkReputationGates({ did: "x", role: "y", slug: "z" }, {}, {}, NOW);
    expect(r.passed).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it("warns when a dimension is below threshold", () => {
    const r = checkReputationGates(
      { did: "x", role: "y", slug: "z", minReputation: { reliability: 0.8 } },
      { reliability: dim(0.5) },
      {},
      NOW,
    );
    expect(r.passed).toBe(false);
    expect(r.warnings[0]).toContain("reliability");
  });

  it("warns when domain-competence is missing", () => {
    const r = checkReputationGates(
      { did: "x", role: "y", slug: "z", minReputation: { "domain-competence:ai": 0.6 } },
      {},
      {},
      NOW,
    );
    expect(r.passed).toBe(false);
    expect(r.warnings[0]).toContain("ai");
  });

  it("passes when all gates met", () => {
    const r = checkReputationGates(
      { did: "x", role: "y", slug: "z", minReputation: { reliability: 0.6 } },
      { reliability: dim(0.9) },
      {},
      NOW,
    );
    expect(r.passed).toBe(true);
  });
});
