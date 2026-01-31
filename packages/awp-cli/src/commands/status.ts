import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { AWP_VERSION, MEMORY_DIR, ARTIFACTS_DIR } from "@agent-workspace/core";
import { findWorkspaceRoot, inspectWorkspace } from "../lib/workspace.js";
import { listProfiles, computeDecayedScore } from "../lib/reputation.js";
import { listContracts } from "../lib/contract.js";
import { listProjects, listTasks } from "../lib/project.js";

/**
 * awp status — rich workspace overview
 */
export async function statusCommand(): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  const info = await inspectWorkspace(root);
  const now = new Date();

  console.log(`AWP Workspace: ${info.manifest.name} (v${AWP_VERSION})`);
  if (info.manifest.agent.did) {
    console.log(`DID: ${info.manifest.agent.did}`);
  }
  console.log(`Root: ${info.root}`);

  // Projects
  const projects = await listProjects(root);
  const activeProjects = projects.filter(
    (p) => p.frontmatter.status === "active" || p.frontmatter.status === "paused"
  );

  if (activeProjects.length > 0) {
    console.log("");
    console.log("--- Projects ---");
    for (const p of activeProjects) {
      const fm = p.frontmatter;
      const slug = fm.id.replace("project:", "");
      const tasks = `${fm.completedCount}/${fm.taskCount} tasks`;
      const deadline = fm.deadline ? `deadline: ${fm.deadline.split("T")[0]}` : "";
      console.log(
        `  ${slug.padEnd(24)} ${fm.status.toUpperCase().padEnd(10)} ${tasks.padEnd(14)} ${deadline}`
      );
    }
  }

  // Active tasks across all projects
  const allTasks: Array<{
    projectSlug: string;
    taskSlug: string;
    status: string;
    assigneeSlug?: string;
    deadline?: string;
    blockedBy: string[];
  }> = [];

  for (const p of activeProjects) {
    const pSlug = p.frontmatter.id.replace("project:", "");
    const tasks = await listTasks(root, pSlug);
    for (const t of tasks) {
      const tfm = t.frontmatter;
      if (tfm.status === "in-progress" || tfm.status === "blocked" || tfm.status === "review") {
        allTasks.push({
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

  if (allTasks.length > 0) {
    console.log("");
    console.log("--- Active Tasks ---");
    for (const t of allTasks) {
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
  const profiles = await listProfiles(root);
  if (profiles.length > 0) {
    console.log("");
    console.log("--- Reputation ---");
    for (const p of profiles) {
      const fm = p.frontmatter;
      const slug = fm.id.replace("reputation:", "");
      const parts: string[] = [];

      // Top dimension scores
      for (const [name, dim] of Object.entries(fm.dimensions || {})) {
        const decayed = computeDecayedScore(dim, now);
        parts.push(`${name}: ${decayed.toFixed(2)}`);
      }
      for (const [name, dim] of Object.entries(fm.domainCompetence || {})) {
        const decayed = computeDecayedScore(dim, now);
        parts.push(`${name}: ${decayed.toFixed(2)}`);
      }

      console.log(`  ${slug.padEnd(20)} ${parts.join("   ")}`);
    }
  }

  // Contracts
  const contracts = await listContracts(root);
  if (contracts.length > 0) {
    const statusCounts: Record<string, number> = {};
    for (const c of contracts) {
      const s = c.frontmatter.status;
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }
    const summary = Object.entries(statusCounts)
      .map(([s, n]) => `${n} ${s}`)
      .join(", ");
    console.log("");
    console.log("--- Contracts ---");
    console.log(`  ${summary}`);
  }

  // Knowledge
  let artifactCount = 0;
  try {
    const artDir = join(root, ARTIFACTS_DIR);
    const files = await readdir(artDir);
    artifactCount = files.filter((f) => f.endsWith(".md")).length;
  } catch {
    // no artifacts dir
  }

  let memoryCount = 0;
  try {
    const memDir = join(root, MEMORY_DIR);
    const files = await readdir(memDir);
    memoryCount = files.filter((f) => f.endsWith(".md")).length;
  } catch {
    // no memory dir
  }

  if (artifactCount > 0 || memoryCount > 0) {
    console.log("");
    console.log("--- Knowledge ---");
    console.log(`  ${artifactCount} artifact(s), ${memoryCount} memory log(s)`);
  }

  // Health checks
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
  for (const t of allTasks) {
    if (
      t.deadline &&
      t.status !== "completed" &&
      t.status !== "cancelled" &&
      new Date(t.deadline) < now
    ) {
      warnings.push(`Task "${t.taskSlug}" is past deadline`);
    }
  }

  console.log("");
  console.log("--- Health ---");
  if (warnings.length === 0 && allRequired) {
    console.log("  [PASS] All systems nominal");
  } else {
    if (allRequired) {
      console.log("  [PASS] All required files present");
    }
    for (const w of warnings) {
      console.log(`  [WARN] ${w}`);
    }
  }
}
