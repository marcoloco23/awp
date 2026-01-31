import { writeFile } from "node:fs/promises";
import { AWP_VERSION, CDP_VERSION } from "@agent-workspace/core";
import type { TaskFrontmatter } from "@agent-workspace/core";
import { analyzeGraph, getTaskSlug, type TaskNode } from "@agent-workspace/utils";
import { requireWorkspaceRoot } from "../lib/cli-utils.js";
import { serializeWorkspaceFile } from "../lib/frontmatter.js";
import {
  validateSlug,
  slugToTaskPath,
  loadProject,
  loadTask,
  listTasks,
  ensureTaskDir,
  computeProjectCounts,
  checkReputationGates,
} from "../lib/project.js";
import { loadProfile } from "../lib/reputation.js";

/**
 * awp task create <project> <slug>
 */
export async function taskCreateCommand(
  projectSlug: string,
  taskSlug: string,
  options: {
    title?: string;
    assignee?: string;
    assigneeSlug?: string;
    priority?: string;
    deadline?: string;
    blockedBy?: string;
    outputArtifact?: string;
    contract?: string;
  }
): Promise<void> {
  const root = await requireWorkspaceRoot();

  if (!validateSlug(taskSlug)) {
    console.error(`Invalid task slug: ${taskSlug} (must be lowercase alphanumeric + hyphens)`);
    process.exit(1);
  }

  // Verify project exists
  let project;
  try {
    project = await loadProject(root, projectSlug);
  } catch {
    console.error(`Project not found: ${projectSlug}`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const title = options.title || taskSlug;
  const priority = (options.priority as TaskFrontmatter["priority"]) || "medium";
  const validPriorities = ["low", "medium", "high", "critical"];
  if (!validPriorities.includes(priority)) {
    console.error(`Invalid priority: ${priority}. Use: ${validPriorities.join(", ")}`);
    process.exit(1);
  }

  const blockedBy = options.blockedBy ? options.blockedBy.split(",").map((b) => b.trim()) : [];

  const fm: TaskFrontmatter = {
    awp: AWP_VERSION,
    cdp: CDP_VERSION,
    type: "task",
    id: `task:${projectSlug}/${taskSlug}`,
    projectId: `project:${projectSlug}`,
    title,
    status: "pending",
    priority,
    created: now,
    blockedBy,
    blocks: [],
  };

  if (options.assignee) fm.assignee = options.assignee;
  if (options.assigneeSlug) fm.assigneeSlug = options.assigneeSlug;
  if (options.deadline) fm.deadline = options.deadline;
  if (options.outputArtifact) fm.outputArtifact = options.outputArtifact;
  if (options.contract) fm.contractSlug = options.contract;

  const body = `# ${title}\n\n` + `## Acceptance Criteria\n\n- \n\n## Notes\n\n- `;

  await ensureTaskDir(root, projectSlug);
  const filePath = slugToTaskPath(root, projectSlug, taskSlug);
  const content = serializeWorkspaceFile({ frontmatter: fm, body, filePath });
  await writeFile(filePath, content, "utf-8");

  // Update project task count
  const counts = await computeProjectCounts(root, projectSlug);
  project.frontmatter.taskCount = counts.taskCount;
  project.frontmatter.completedCount = counts.completedCount;
  const projContent = serializeWorkspaceFile(project);
  await writeFile(project.filePath, projContent, "utf-8");

  console.log(`Created projects/${projectSlug}/tasks/${taskSlug}.md (${priority}, ${fm.status})`);

  // Check reputation gates if assignee is specified
  if (options.assigneeSlug) {
    const member = project.frontmatter.members.find((m) => m.slug === options.assigneeSlug);
    if (member?.minReputation) {
      try {
        const profile = await loadProfile(root, options.assigneeSlug);
        const result = checkReputationGates(
          member,
          profile.frontmatter.dimensions,
          profile.frontmatter.domainCompetence,
          new Date()
        );
        if (!result.passed) {
          console.log("");
          console.log("Reputation gate warnings:");
          for (const w of result.warnings) {
            console.log(`  [WARN] ${w}`);
          }
        }
      } catch {
        console.log(`  Note: No reputation profile for ${options.assigneeSlug}`);
      }
    }
  }
}

/**
 * awp task list <project>
 */
export async function taskListCommand(
  projectSlug: string,
  options: { status?: string; assignee?: string }
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let tasks = await listTasks(root, projectSlug);

  if (options.status) {
    tasks = tasks.filter((t) => t.frontmatter.status === options.status);
  }
  if (options.assignee) {
    tasks = tasks.filter((t) => t.frontmatter.assigneeSlug === options.assignee);
  }

  if (tasks.length === 0) {
    console.log(
      options.status || options.assignee
        ? "No matching tasks found."
        : `No tasks found for project ${projectSlug}.`
    );
    return;
  }

  const header = "TASK                     STATUS         PRIORITY   ASSIGNEE             DEADLINE";
  console.log(header);
  console.log("-".repeat(header.length));

  for (const t of tasks) {
    const tfm = t.frontmatter;
    const taskSlug = tfm.id.split("/")[1];
    const assignee = tfm.assigneeSlug || "—";
    const deadline = tfm.deadline ? tfm.deadline.split("T")[0] : "—";
    console.log(
      `${taskSlug.padEnd(24)} ${tfm.status.padEnd(14)} ${tfm.priority.padEnd(10)} ${assignee.padEnd(20)} ${deadline}`
    );
  }
}

/**
 * awp task update <project> <slug>
 */
export async function taskUpdateCommand(
  projectSlug: string,
  taskSlug: string,
  options: {
    status?: string;
    assignee?: string;
    assigneeSlug?: string;
  }
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let task;
  try {
    task = await loadTask(root, projectSlug, taskSlug);
  } catch {
    console.error(`Task not found: ${projectSlug}/${taskSlug}`);
    process.exit(1);
  }

  const fm = task.frontmatter;
  const changes: string[] = [];

  if (options.status) {
    const validStatuses = ["pending", "in-progress", "blocked", "review", "completed", "cancelled"];
    if (!validStatuses.includes(options.status)) {
      console.error(`Invalid status: ${options.status}. Use: ${validStatuses.join(", ")}`);
      process.exit(1);
    }
    fm.status = options.status as TaskFrontmatter["status"];
    changes.push(`status → ${options.status}`);
  }

  if (options.assignee) {
    fm.assignee = options.assignee;
    changes.push(`assignee → ${options.assignee}`);
  }
  if (options.assigneeSlug) {
    fm.assigneeSlug = options.assigneeSlug;
    changes.push(`assignee-slug → ${options.assigneeSlug}`);

    // Check reputation gates
    let project;
    try {
      project = await loadProject(root, projectSlug);
      const member = project.frontmatter.members.find((m) => m.slug === options.assigneeSlug);
      if (member?.minReputation) {
        try {
          const profile = await loadProfile(root, options.assigneeSlug);
          const result = checkReputationGates(
            member,
            profile.frontmatter.dimensions,
            profile.frontmatter.domainCompetence,
            new Date()
          );
          if (!result.passed) {
            console.log("Reputation gate warnings:");
            for (const w of result.warnings) {
              console.log(`  [WARN] ${w}`);
            }
          }
        } catch {
          // No profile — that's ok
        }
      }
    } catch {
      // Project not found — skip gate check
    }
  }

  if (changes.length === 0) {
    console.log("No changes specified.");
    return;
  }

  const content = serializeWorkspaceFile(task);
  await writeFile(task.filePath, content, "utf-8");

  // Update project counts if status changed
  if (options.status) {
    try {
      const project = await loadProject(root, projectSlug);
      const counts = await computeProjectCounts(root, projectSlug);
      project.frontmatter.taskCount = counts.taskCount;
      project.frontmatter.completedCount = counts.completedCount;
      const projContent = serializeWorkspaceFile(project);
      await writeFile(project.filePath, projContent, "utf-8");
    } catch {
      // Project update failed — non-fatal
    }
  }

  console.log(`Updated ${projectSlug}/${taskSlug}: ${changes.join(", ")}`);

  // Warn about downstream blockers when completing
  if (options.status === "completed" && fm.blocks.length > 0) {
    console.log("");
    console.log("Note: The following tasks were blocked by this one:");
    for (const blocked of fm.blocks) {
      console.log(`  ${blocked}`);
    }
  }
}

/**
 * awp task show <project> <slug>
 */
export async function taskShowCommand(projectSlug: string, taskSlug: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  let task;
  try {
    task = await loadTask(root, projectSlug, taskSlug);
  } catch {
    console.error(`Task not found: ${projectSlug}/${taskSlug}`);
    process.exit(1);
  }

  const fm = task.frontmatter;

  console.log(`Task: ${fm.title}`);
  console.log(`ID:       ${fm.id}`);
  console.log(`Project:  ${fm.projectId}`);
  console.log(`Status:   ${fm.status}`);
  console.log(`Priority: ${fm.priority}`);
  console.log(`Created:  ${fm.created}`);
  if (fm.deadline) console.log(`Deadline: ${fm.deadline}`);

  if (fm.assignee) {
    console.log(`Assignee: ${fm.assigneeSlug ? `@${fm.assigneeSlug}` : fm.assignee}`);
  } else {
    console.log("Assignee: unassigned");
  }

  if ((fm.blockedBy ?? []).length > 0) {
    console.log("");
    console.log("Blocked By");
    console.log("----------");
    for (const dep of fm.blockedBy) {
      console.log(`  ${dep}`);
    }
  }

  if ((fm.blocks ?? []).length > 0) {
    console.log("");
    console.log("Blocks");
    console.log("------");
    for (const dep of fm.blocks) {
      console.log(`  ${dep}`);
    }
  }

  if (fm.outputArtifact) console.log(`\nOutput Artifact: ${fm.outputArtifact}`);
  if (fm.contractSlug) console.log(`Contract: ${fm.contractSlug}`);
  if (fm.tags?.length) console.log(`Tags: ${fm.tags.join(", ")}`);
}

/**
 * awp task graph <project>
 * Analyze task dependencies: topological order, cycles, critical path, blocked tasks
 */
export async function taskGraphCommand(
  projectSlug: string,
  options: { check?: boolean; json?: boolean }
): Promise<void> {
  const root = await requireWorkspaceRoot();

  // Load all tasks for the project
  const tasks = await listTasks(root, projectSlug);

  if (tasks.length === 0) {
    console.log(`No tasks found for project ${projectSlug}.`);
    return;
  }

  // Convert to TaskNode format for the graph analysis
  const taskNodes: TaskNode[] = tasks.map((t) => ({
    id: t.frontmatter.id,
    blockedBy: t.frontmatter.blockedBy || [],
    blocks: t.frontmatter.blocks || [],
    status: t.frontmatter.status,
  }));

  // Run graph analysis
  const analysis = analyzeGraph(taskNodes);

  // JSON output mode
  if (options.json) {
    const output = {
      isValid: analysis.isValid,
      sorted: analysis.sorted,
      cycles: analysis.cycles,
      criticalPath: analysis.criticalPath,
      blocked: Object.fromEntries(analysis.blocked),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  // Check mode - just validate and exit with error code if cycles found
  if (options.check) {
    if (!analysis.isValid) {
      console.error("ERROR: Dependency cycles detected!");
      for (const cycle of analysis.cycles) {
        const cycleSlugs = cycle.map((id) => getTaskSlug(id));
        console.error(`  Cycle: ${cycleSlugs.join(" → ")}`);
      }
      process.exit(1);
    }
    console.log("OK: No dependency cycles found.");
    return;
  }

  // Standard output
  console.log(`Dependency Analysis for project: ${projectSlug}`);
  console.log("=".repeat(50));

  // Cycles (if any)
  if (analysis.cycles.length > 0) {
    console.log("");
    console.log("WARNING: Dependency Cycles Detected");
    console.log("-".repeat(35));
    for (const cycle of analysis.cycles) {
      const cycleSlugs = cycle.map((id) => getTaskSlug(id));
      console.log(`  ${cycleSlugs.join(" → ")}`);
    }
  }

  // Topological order
  console.log("");
  console.log("Task Order (topological)");
  console.log("-".repeat(24));
  if (analysis.sorted) {
    for (let i = 0; i < analysis.sorted.length; i++) {
      const taskId = analysis.sorted[i];
      const slug = getTaskSlug(taskId);
      const task = tasks.find((t) => t.frontmatter.id === taskId);
      const status = task?.frontmatter.status || "unknown";
      console.log(`  ${(i + 1).toString().padStart(2)}. ${slug} (${status})`);
    }
  } else {
    console.log("  Unable to compute order (cycles present)");
  }

  // Critical path
  if (analysis.criticalPath.length > 0) {
    console.log("");
    console.log("Critical Path");
    console.log("-".repeat(13));
    const pathSlugs = analysis.criticalPath.map((id) => getTaskSlug(id));
    console.log(`  ${pathSlugs.join(" → ")} (${analysis.criticalPath.length} tasks)`);
  }

  // Blocked tasks
  if (analysis.blocked.size > 0) {
    console.log("");
    console.log("Blocked Tasks");
    console.log("-".repeat(13));
    for (const [taskId, blockers] of analysis.blocked) {
      const slug = getTaskSlug(taskId);
      const blockerSlugs = blockers.map((b) => getTaskSlug(b));
      const task = tasks.find((t) => t.frontmatter.id === taskId);
      const blockerStatuses = blockers.map((b) => {
        const blocker = tasks.find((t) => t.frontmatter.id === b);
        return blocker?.frontmatter.status || "unknown";
      });
      console.log(
        `  ${slug}: waiting on ${blockerSlugs.map((s, i) => `${s} (${blockerStatuses[i]})`).join(", ")}`
      );
    }
  } else {
    console.log("");
    console.log("No blocked tasks.");
  }
}
