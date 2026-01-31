import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AWP_VERSION,
  CDP_VERSION,
  PROJECTS_DIR,
} from "@agent-workspace/core";
import type { ProjectFrontmatter } from "@agent-workspace/core";
import { findWorkspaceRoot } from "../lib/workspace.js";
import { serializeWorkspaceFile } from "../lib/frontmatter.js";
import {
  validateSlug,
  slugToProjectPath,
  loadProject,
  listProjects,
  listTasks,
  computeProjectCounts,
} from "../lib/project.js";
import { getAgentDid } from "../lib/artifact.js";
import { mkdir } from "node:fs/promises";

/**
 * awp project create <slug>
 */
export async function projectCreateCommand(
  slug: string,
  options: {
    title?: string;
    deadline?: string;
    tags?: string;
  }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  if (!validateSlug(slug)) {
    console.error(
      `Invalid slug: ${slug} (must be lowercase alphanumeric + hyphens)`
    );
    process.exit(1);
  }

  const ownerDid = await getAgentDid(root);
  const now = new Date().toISOString();
  const title = options.title || slug;

  const fm: ProjectFrontmatter = {
    awp: AWP_VERSION,
    cdp: CDP_VERSION,
    type: "project",
    id: `project:${slug}`,
    title,
    status: "active",
    owner: ownerDid,
    created: now,
    members: [
      {
        did: ownerDid,
        role: "lead",
        slug: "self",
      },
    ],
    tags: options.tags ? options.tags.split(",").map((t) => t.trim()) : [],
    taskCount: 0,
    completedCount: 0,
  };

  if (options.deadline) fm.deadline = options.deadline;

  const body =
    `# ${title}\n\n` +
    `Project created ${now.split("T")[0]}.\n\n` +
    `## Goals\n\n- \n\n## Notes\n\n- `;

  await mkdir(join(root, PROJECTS_DIR), { recursive: true });
  const filePath = slugToProjectPath(root, slug);
  const content = serializeWorkspaceFile({ frontmatter: fm, body, filePath });
  await writeFile(filePath, content, "utf-8");
  console.log(`Created projects/${slug}.md (status: active)`);
}

/**
 * awp project list
 */
export async function projectListCommand(options: {
  status?: string;
}): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  let projects = await listProjects(root);

  if (options.status) {
    projects = projects.filter(
      (p) => p.frontmatter.status === options.status
    );
  }

  if (projects.length === 0) {
    console.log(
      options.status
        ? `No projects with status: ${options.status}`
        : "No projects found."
    );
    return;
  }

  const header =
    "SLUG                 TITLE                STATUS      TASKS       DEADLINE";
  console.log(header);
  console.log("-".repeat(header.length));

  for (const p of projects) {
    const fm = p.frontmatter;
    const slug = fm.id.replace("project:", "");
    const tasks = `${fm.completedCount}/${fm.taskCount}`;
    const deadline = fm.deadline ? fm.deadline.split("T")[0] : "—";
    console.log(
      `${slug.padEnd(20)} ${fm.title.slice(0, 20).padEnd(20)} ${fm.status.padEnd(11)} ${tasks.padEnd(11)} ${deadline}`
    );
  }
}

/**
 * awp project show <slug>
 */
export async function projectShowCommand(slug: string): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  let project;
  try {
    project = await loadProject(root, slug);
  } catch {
    console.error(`Project not found: ${slug}`);
    process.exit(1);
  }

  const fm = project.frontmatter;

  console.log(`Project: ${fm.title}`);
  console.log(`ID:      ${fm.id}`);
  console.log(`Status:  ${fm.status}`);
  console.log(`Owner:   ${fm.owner}`);
  console.log(`Created: ${fm.created}`);
  if (fm.deadline) console.log(`Deadline: ${fm.deadline}`);
  if (fm.tags?.length) console.log(`Tags:    ${fm.tags.join(", ")}`);
  console.log(`Tasks:   ${fm.completedCount}/${fm.taskCount} completed`);

  // Members
  console.log("");
  console.log("Members");
  console.log("-------");
  for (const m of fm.members) {
    const gates = m.minReputation
      ? ` (requires: ${Object.entries(m.minReputation)
          .map(([k, v]) => `${k}>=${v}`)
          .join(", ")})`
      : "";
    console.log(`  ${m.slug} — ${m.role}${gates}`);
  }

  // Tasks
  const tasks = await listTasks(root, slug);
  if (tasks.length > 0) {
    console.log("");
    console.log("Tasks");
    console.log("-----");
    for (const t of tasks) {
      const tfm = t.frontmatter;
      const taskSlug = tfm.id.split("/")[1];
      const assignee = tfm.assigneeSlug ? `@${tfm.assigneeSlug}` : "unassigned";
      const priority = tfm.priority === "critical" || tfm.priority === "high"
        ? ` [${tfm.priority.toUpperCase()}]`
        : "";
      console.log(
        `  ${taskSlug.padEnd(24)} ${tfm.status.padEnd(14)} ${assignee}${priority}`
      );
    }
  }
}

/**
 * awp project close <slug>
 */
export async function projectCloseCommand(slug: string): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  let project;
  try {
    project = await loadProject(root, slug);
  } catch {
    console.error(`Project not found: ${slug}`);
    process.exit(1);
  }

  if (project.frontmatter.status === "completed") {
    console.log("Project is already completed.");
    return;
  }

  if (project.frontmatter.status === "archived") {
    console.log("Project is archived.");
    return;
  }

  // Recalculate counts before closing
  const counts = await computeProjectCounts(root, slug);
  project.frontmatter.taskCount = counts.taskCount;
  project.frontmatter.completedCount = counts.completedCount;
  project.frontmatter.status = "completed";

  const content = serializeWorkspaceFile(project);
  await writeFile(project.filePath, content, "utf-8");

  const incomplete = counts.taskCount - counts.completedCount;
  console.log(`Closed projects/${slug}.md`);
  if (incomplete > 0) {
    console.log(`  Note: ${incomplete} task(s) still incomplete.`);
  }
}
