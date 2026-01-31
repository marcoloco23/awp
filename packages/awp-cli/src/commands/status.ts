import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { AWP_VERSION, MEMORY_DIR, ARTIFACTS_DIR } from "@agent-workspace/core";
import { inspectWorkspace } from "../lib/workspace.js";
import { requireWorkspaceRoot } from "../lib/cli-utils.js";
import { listProfiles, computeDecayedScore } from "../lib/reputation.js";
import { listContracts } from "../lib/contract.js";
import { listProjects, listTasks } from "../lib/project.js";

/** Structured status data for JSON output */
interface StatusData {
  workspace: {
    name: string;
    awp: string;
    did?: string;
    root: string;
  };
  projects: Array<{
    slug: string;
    title: string;
    status: string;
    taskCount: number;
    completedCount: number;
    deadline?: string;
  }>;
  activeTasks: Array<{
    projectSlug: string;
    taskSlug: string;
    status: string;
    assigneeSlug?: string;
    deadline?: string;
    blockedBy: string[];
  }>;
  reputation: Array<{
    slug: string;
    agentName: string;
    dimensions: Record<string, number>;
    domainCompetence: Record<string, number>;
  }>;
  contracts: {
    total: number;
    byStatus: Record<string, number>;
  };
  knowledge: {
    artifactCount: number;
    memoryLogCount: number;
  };
  health: {
    status: "healthy" | "warnings";
    warnings: string[];
  };
}

/**
 * awp status — rich workspace overview
 * Supports --json flag for machine-readable output (agent-friendly)
 */
export async function statusCommand(options?: { json?: boolean }): Promise<void> {
  const root = await requireWorkspaceRoot();
  const info = await inspectWorkspace(root);
  const now = new Date();
  const jsonMode = options?.json ?? false;

  // Initialize structured data
  const statusData: StatusData = {
    workspace: {
      name: info.manifest.name,
      awp: AWP_VERSION,
      did: info.manifest.agent.did,
      root: info.root,
    },
    projects: [],
    activeTasks: [],
    reputation: [],
    contracts: { total: 0, byStatus: {} },
    knowledge: { artifactCount: 0, memoryLogCount: 0 },
    health: { status: "healthy", warnings: [] },
  };

  // --- Collect Projects ---
  const projects = await listProjects(root);
  const activeProjects = projects.filter(
    (p) => p.frontmatter.status === "active" || p.frontmatter.status === "paused"
  );

  for (const p of activeProjects) {
    const fm = p.frontmatter;
    statusData.projects.push({
      slug: fm.id.replace("project:", ""),
      title: fm.title,
      status: fm.status,
      taskCount: fm.taskCount,
      completedCount: fm.completedCount,
      deadline: fm.deadline,
    });
  }

  // --- Collect Active Tasks ---
  for (const p of activeProjects) {
    const pSlug = p.frontmatter.id.replace("project:", "");
    const tasks = await listTasks(root, pSlug);
    for (const t of tasks) {
      const tfm = t.frontmatter;
      if (tfm.status === "in-progress" || tfm.status === "blocked" || tfm.status === "review") {
        statusData.activeTasks.push({
          projectSlug: pSlug,
          taskSlug: tfm.id.split("/")[1],
          status: tfm.status,
          assigneeSlug: tfm.assigneeSlug,
          deadline: tfm.deadline,
          blockedBy: tfm.blockedBy,
        });
      }
    }
  }

  // --- Collect Reputation ---
  const profiles = await listProfiles(root);
  for (const p of profiles) {
    const fm = p.frontmatter;
    const dimensions: Record<string, number> = {};
    const domainCompetence: Record<string, number> = {};

    for (const [name, dim] of Object.entries(fm.dimensions || {})) {
      dimensions[name] = computeDecayedScore(dim, now);
    }
    for (const [name, dim] of Object.entries(fm.domainCompetence || {})) {
      domainCompetence[name] = computeDecayedScore(dim, now);
    }

    statusData.reputation.push({
      slug: fm.id.replace("reputation:", ""),
      agentName: fm.agentName,
      dimensions,
      domainCompetence,
    });
  }

  // --- Collect Contracts ---
  const contracts = await listContracts(root);
  statusData.contracts.total = contracts.length;
  for (const c of contracts) {
    const s = c.frontmatter.status;
    statusData.contracts.byStatus[s] = (statusData.contracts.byStatus[s] || 0) + 1;
  }

  // --- Collect Knowledge ---
  try {
    const artDir = join(root, ARTIFACTS_DIR);
    const files = await readdir(artDir);
    statusData.knowledge.artifactCount = files.filter((f) => f.endsWith(".md")).length;
  } catch {
    // no artifacts dir
  }

  try {
    const memDir = join(root, MEMORY_DIR);
    const files = await readdir(memDir);
    statusData.knowledge.memoryLogCount = files.filter((f) => f.endsWith(".md")).length;
  } catch {
    // no memory dir
  }

  // --- Health Checks ---
  const warnings: string[] = [];

  // Check required files
  const allRequired = info.files.required.every((f) => f.exists && f.valid);
  if (!allRequired) {
    const missing = info.files.required.filter((f) => !f.exists || !f.valid).map((f) => f.file);
    warnings.push(`Required files missing or invalid: ${missing.join(", ")}`);
  }

  // Check contracts past deadline
  for (const c of contracts) {
    const fm = c.frontmatter;
    if (
      fm.deadline &&
      (fm.status === "active" || fm.status === "draft") &&
      new Date(fm.deadline) < now
    ) {
      const slug = fm.id.replace("contract:", "");
      warnings.push(`Contract "${slug}" is past deadline`);
    }
  }

  // Check reputation decay
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  for (const p of profiles) {
    const fm = p.frontmatter;
    const lastUpdated = new Date(fm.lastUpdated);
    const daysSince = Math.floor((now.getTime() - lastUpdated.getTime()) / MS_PER_DAY);
    if (daysSince > 30) {
      const slug = fm.id.replace("reputation:", "");
      warnings.push(`${slug} reputation decaying (no signal in ${daysSince} days)`);
    }
  }

  // Check task deadlines
  for (const t of statusData.activeTasks) {
    if (t.deadline && t.status !== "completed" && new Date(t.deadline) < now) {
      warnings.push(`Task "${t.taskSlug}" is past deadline`);
    }
  }

  statusData.health.warnings = warnings;
  statusData.health.status = warnings.length === 0 ? "healthy" : "warnings";

  // --- Output ---
  if (jsonMode) {
    console.log(JSON.stringify(statusData, null, 2));
    return;
  }

  // Human-readable output
  console.log(`AWP Workspace: ${statusData.workspace.name} (v${statusData.workspace.awp})`);
  if (statusData.workspace.did) {
    console.log(`DID: ${statusData.workspace.did}`);
  }
  console.log(`Root: ${statusData.workspace.root}`);

  // Projects
  if (statusData.projects.length > 0) {
    console.log("");
    console.log("--- Projects ---");
    for (const p of statusData.projects) {
      const tasks = `${p.completedCount}/${p.taskCount} tasks`;
      const deadline = p.deadline ? `deadline: ${p.deadline.split("T")[0]}` : "";
      console.log(
        `  ${p.slug.padEnd(24)} ${p.status.toUpperCase().padEnd(10)} ${tasks.padEnd(14)} ${deadline}`
      );
    }
  }

  // Active tasks
  if (statusData.activeTasks.length > 0) {
    console.log("");
    console.log("--- Active Tasks ---");
    for (const t of statusData.activeTasks) {
      const assignee = t.assigneeSlug ? `@${t.assigneeSlug}` : "unassigned";
      const due = t.deadline ? `due ${t.deadline.split("T")[0]}` : "";
      const blocked =
        t.status === "blocked" && t.blockedBy.length > 0
          ? `blocked by: ${t.blockedBy.map((b) => b.split("/").pop()).join(", ")}`
          : "";
      const extra = blocked || due;
      console.log(
        `  ${t.taskSlug.padEnd(24)} ${t.status.toUpperCase().padEnd(14)} ${assignee.padEnd(20)} ${extra}`
      );
    }
  }

  // Reputation
  if (statusData.reputation.length > 0) {
    console.log("");
    console.log("--- Reputation ---");
    for (const r of statusData.reputation) {
      const parts: string[] = [];
      for (const [name, score] of Object.entries(r.dimensions)) {
        parts.push(`${name}: ${score.toFixed(2)}`);
      }
      for (const [name, score] of Object.entries(r.domainCompetence)) {
        parts.push(`${name}: ${score.toFixed(2)}`);
      }
      console.log(`  ${r.slug.padEnd(20)} ${parts.join("   ")}`);
    }
  }

  // Contracts
  if (statusData.contracts.total > 0) {
    const summary = Object.entries(statusData.contracts.byStatus)
      .map(([s, n]) => `${n} ${s}`)
      .join(", ");
    console.log("");
    console.log("--- Contracts ---");
    console.log(`  ${summary}`);
  }

  // Knowledge
  if (statusData.knowledge.artifactCount > 0 || statusData.knowledge.memoryLogCount > 0) {
    console.log("");
    console.log("--- Knowledge ---");
    console.log(
      `  ${statusData.knowledge.artifactCount} artifact(s), ${statusData.knowledge.memoryLogCount} memory log(s)`
    );
  }

  // Health
  console.log("");
  console.log("--- Health ---");
  if (statusData.health.status === "healthy") {
    console.log("  [PASS] All systems nominal");
  } else {
    if (allRequired) {
      console.log("  [PASS] All required files present");
    }
    for (const w of statusData.health.warnings) {
      console.log(`  [WARN] ${w}`);
    }
  }
}
