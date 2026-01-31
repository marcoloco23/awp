import { writeFile } from "node:fs/promises";
import { AWP_VERSION, CDP_VERSION, SWARMS_DIR } from "@agent-workspace/core";
import type { SwarmFrontmatter, SwarmRole } from "@agent-workspace/core";
import {
  findCandidatesForRole,
  autoRecruitSwarm,
  getSwarmStaffingSummary,
} from "@agent-workspace/utils";
import { requireWorkspaceRoot } from "../lib/cli-utils.js";
import { serializeWorkspaceFile } from "../lib/frontmatter.js";
import { listProfiles } from "../lib/reputation.js";
import {
  validateSlug,
  slugToSwarmPath,
  loadSwarm,
  listSwarms,
  ensureSwarmsDir,
} from "../lib/swarm.js";
import { join } from "node:path";
import { access } from "node:fs/promises";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * awp swarm create <slug>
 */
export async function swarmCreateCommand(
  slug: string,
  options: {
    name?: string;
    goal?: string;
    project?: string;
    humanLead?: string;
    vetoPower?: boolean;
  }
): Promise<void> {
  const root = await requireWorkspaceRoot();

  if (!validateSlug(slug)) {
    console.error(`Invalid swarm slug: ${slug} (must be lowercase alphanumeric + hyphens)`);
    process.exit(1);
  }

  await ensureSwarmsDir(root);

  const filePath = slugToSwarmPath(root, slug);
  if (await fileExists(filePath)) {
    console.error(`Swarm "${slug}" already exists.`);
    process.exit(1);
  }

  const now = new Date().toISOString();
  const name =
    options.name ||
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  const fm: SwarmFrontmatter = {
    awp: AWP_VERSION,
    cdp: CDP_VERSION,
    type: "swarm",
    id: `swarm:${slug}`,
    name,
    goal: options.goal || "Define the goal for this swarm",
    status: "recruiting",
    created: now,
    roles: [],
  };

  if (options.project) {
    fm.projectId = `project:${options.project}`;
  }

  if (options.humanLead || options.vetoPower !== undefined) {
    fm.governance = {};
    if (options.humanLead) fm.governance.humanLead = options.humanLead;
    if (options.vetoPower !== undefined) fm.governance.vetoPower = options.vetoPower;
  }

  const body = `# ${name}\n\n${fm.goal}\n\n## Roles\n\nNo roles defined yet. Use \`awp swarm role add ${slug} <role-name>\` to add roles.\n`;

  const content = serializeWorkspaceFile({ frontmatter: fm, body, filePath });
  await writeFile(filePath, content, "utf-8");

  console.log(`Created swarms/${slug}.md (status: recruiting)`);
}

/**
 * awp swarm role add <swarm> <role>
 */
export async function swarmRoleAddCommand(
  swarmSlug: string,
  roleName: string,
  options: {
    count?: string;
    minReputation?: string[];
  }
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let swarm;
  try {
    swarm = await loadSwarm(root, swarmSlug);
  } catch {
    console.error(`Swarm not found: ${swarmSlug}`);
    process.exit(1);
  }

  // Check if role already exists
  if (swarm.frontmatter.roles.some((r) => r.name === roleName)) {
    console.error(`Role "${roleName}" already exists in swarm "${swarmSlug}".`);
    process.exit(1);
  }

  const count = options.count ? parseInt(options.count, 10) : 1;
  if (isNaN(count) || count < 1) {
    console.error("Invalid count: must be a positive integer.");
    process.exit(1);
  }

  // Parse min-reputation options: "dimension:score" or "domain-competence:domain:score"
  const minReputation: Record<string, number> = {};
  if (options.minReputation) {
    for (const rep of options.minReputation) {
      const parts = rep.split(":");
      if (parts.length === 2) {
        // dimension:score
        const [dim, scoreStr] = parts;
        const score = parseFloat(scoreStr);
        if (isNaN(score) || score < 0 || score > 1) {
          console.error(`Invalid score for ${dim}: must be 0.0-1.0`);
          process.exit(1);
        }
        minReputation[dim] = score;
      } else if (parts.length === 3 && parts[0] === "domain-competence") {
        // domain-competence:domain:score
        const [, domain, scoreStr] = parts;
        const score = parseFloat(scoreStr);
        if (isNaN(score) || score < 0 || score > 1) {
          console.error(`Invalid score for domain ${domain}: must be 0.0-1.0`);
          process.exit(1);
        }
        minReputation[`domain-competence:${domain}`] = score;
      } else {
        console.error(
          `Invalid reputation format: ${rep}. Use "dimension:score" or "domain-competence:domain:score"`
        );
        process.exit(1);
      }
    }
  }

  const role: SwarmRole = {
    name: roleName,
    count,
    assigned: [],
  };
  if (Object.keys(minReputation).length > 0) {
    role.minReputation = minReputation;
  }

  swarm.frontmatter.roles.push(role);

  const content = serializeWorkspaceFile(swarm);
  await writeFile(swarm.filePath, content, "utf-8");

  console.log(`Added role "${roleName}" (count: ${count}) to swarm "${swarmSlug}"`);
  if (Object.keys(minReputation).length > 0) {
    console.log("Reputation requirements:");
    for (const [dim, score] of Object.entries(minReputation)) {
      console.log(`  ${dim}: ${score}`);
    }
  }
}

/**
 * awp swarm recruit <swarm>
 */
export async function swarmRecruitCommand(
  swarmSlug: string,
  options: { auto?: boolean }
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let swarm;
  try {
    swarm = await loadSwarm(root, swarmSlug);
  } catch {
    console.error(`Swarm not found: ${swarmSlug}`);
    process.exit(1);
  }

  if (swarm.frontmatter.roles.length === 0) {
    console.log(`Swarm "${swarmSlug}" has no roles defined.`);
    return;
  }

  // Load all reputation profiles
  const profileFiles = await listProfiles(root);
  const profiles = profileFiles.map((p) => p.frontmatter);

  if (profiles.length === 0) {
    console.log("No reputation profiles found in workspace.");
    return;
  }

  const now = new Date();

  if (options.auto) {
    // Auto-recruit mode
    const results = autoRecruitSwarm(swarm.frontmatter, profiles, now);
    let anyAssigned = false;

    for (const result of results) {
      if (result.assigned.length > 0) {
        anyAssigned = true;
        // Update the swarm's role
        const role = swarm.frontmatter.roles.find((r) => r.name === result.role);
        if (role) {
          role.assigned.push(...result.assigned);
          if (!role.assignedSlugs) role.assignedSlugs = [];
          role.assignedSlugs.push(...result.assignedSlugs);
        }
        console.log(`Assigned to ${result.role}: ${result.assignedSlugs.join(", ")}`);
      }
      if (result.unfilled > 0) {
        console.log(`  ${result.role}: ${result.unfilled} slot(s) still unfilled`);
      }
    }

    if (anyAssigned) {
      // Check if fully staffed, update status
      const summary = getSwarmStaffingSummary(swarm.frontmatter);
      if (summary.needed === 0 && swarm.frontmatter.status === "recruiting") {
        swarm.frontmatter.status = "active";
        console.log(`\nSwarm "${swarmSlug}" is now fully staffed. Status: active`);
      }

      const content = serializeWorkspaceFile(swarm);
      await writeFile(swarm.filePath, content, "utf-8");
    } else {
      console.log("No qualified candidates found for any unfilled roles.");
    }
    return;
  }

  // Interactive mode - show candidates for each role
  console.log(`Recruitment Candidates for swarm: ${swarmSlug}`);
  console.log("=".repeat(50));

  for (const role of swarm.frontmatter.roles) {
    const filled = role.assigned.length;
    const needed = role.count;

    console.log("");
    console.log(`Role: ${role.name} (${filled}/${needed} filled)`);
    console.log("-".repeat(30));

    if (filled >= needed) {
      console.log("  [Fully staffed]");
      continue;
    }

    const candidates = findCandidatesForRole(role, profiles, now);

    if (candidates.length === 0) {
      console.log("  No candidates available.");
      continue;
    }

    for (const candidate of candidates) {
      const status = candidate.qualifies ? "✓ qualifies" : "✗ below threshold";
      const scoreStr = Object.entries(candidate.scores)
        .map(([dim, score]) => {
          const dimName = dim.startsWith("domain-competence:")
            ? dim.slice("domain-competence:".length)
            : dim;
          return `${dimName}: ${score.toFixed(2)}`;
        })
        .join(", ");

      console.log(`  ${candidate.slug} (${scoreStr}) ${status}`);
      if (candidate.gaps.length > 0) {
        console.log(`    Gaps: ${candidate.gaps.join(", ")}`);
      }
    }
  }

  console.log("");
  console.log("Use --auto to automatically assign qualified candidates.");
}

/**
 * awp swarm show <slug>
 */
export async function swarmShowCommand(swarmSlug: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  let swarm;
  try {
    swarm = await loadSwarm(root, swarmSlug);
  } catch {
    console.error(`Swarm not found: ${swarmSlug}`);
    process.exit(1);
  }

  const fm = swarm.frontmatter;
  const summary = getSwarmStaffingSummary(fm);

  console.log(`Swarm: ${fm.name}`);
  console.log(`ID:       ${fm.id}`);
  console.log(`Status:   ${fm.status}`);
  console.log(`Goal:     ${fm.goal}`);
  console.log(`Created:  ${fm.created}`);
  if (fm.projectId) console.log(`Project:  ${fm.projectId}`);

  if (fm.governance) {
    console.log("");
    console.log("Governance");
    console.log("----------");
    if (fm.governance.humanLead) console.log(`  Human Lead: ${fm.governance.humanLead}`);
    if (fm.governance.vetoPower !== undefined)
      console.log(`  Veto Power: ${fm.governance.vetoPower}`);
    if (fm.governance.escalationThreshold !== undefined)
      console.log(`  Escalation Threshold: ${fm.governance.escalationThreshold}`);
  }

  console.log("");
  console.log(`Staffing: ${summary.filled}/${summary.total}`);
  console.log("-".repeat(20));

  for (const role of fm.roles) {
    const filled = role.assigned.length;
    const statusIcon = filled >= role.count ? "✓" : "○";
    console.log(`  ${statusIcon} ${role.name}: ${filled}/${role.count}`);

    if (role.assignedSlugs && role.assignedSlugs.length > 0) {
      console.log(`    Assigned: ${role.assignedSlugs.join(", ")}`);
    }

    if (role.minReputation && Object.keys(role.minReputation).length > 0) {
      const reqs = Object.entries(role.minReputation)
        .map(([dim, score]) => `${dim}≥${score}`)
        .join(", ");
      console.log(`    Requirements: ${reqs}`);
    }
  }

  if (fm.tags?.length) {
    console.log("");
    console.log(`Tags: ${fm.tags.join(", ")}`);
  }
}

/**
 * awp swarm list
 */
export async function swarmListCommand(options: { status?: string }): Promise<void> {
  const root = await requireWorkspaceRoot();

  let swarms = await listSwarms(root);

  if (options.status) {
    swarms = swarms.filter((s) => s.frontmatter.status === options.status);
  }

  if (swarms.length === 0) {
    console.log(
      options.status
        ? `No swarms with status "${options.status}" found.`
        : "No swarms found in workspace."
    );
    return;
  }

  const header = "SWARM                    STATUS       STAFFING   GOAL";
  console.log(header);
  console.log("-".repeat(header.length));

  for (const swarm of swarms) {
    const fm = swarm.frontmatter;
    const slug = fm.id.replace("swarm:", "");
    const summary = getSwarmStaffingSummary(fm);
    const staffing = `${summary.filled}/${summary.total}`;
    const goalPreview = fm.goal.slice(0, 30) + (fm.goal.length > 30 ? "..." : "");

    console.log(`${slug.padEnd(24)} ${fm.status.padEnd(12)} ${staffing.padEnd(10)} ${goalPreview}`);
  }
}

/**
 * awp swarm update <slug>
 */
export async function swarmUpdateCommand(
  swarmSlug: string,
  options: { status?: string }
): Promise<void> {
  const root = await requireWorkspaceRoot();

  let swarm;
  try {
    swarm = await loadSwarm(root, swarmSlug);
  } catch {
    console.error(`Swarm not found: ${swarmSlug}`);
    process.exit(1);
  }

  const changes: string[] = [];

  if (options.status) {
    const validStatuses = ["recruiting", "active", "completed", "disbanded"];
    if (!validStatuses.includes(options.status)) {
      console.error(`Invalid status: ${options.status}. Use: ${validStatuses.join(", ")}`);
      process.exit(1);
    }
    swarm.frontmatter.status = options.status as SwarmFrontmatter["status"];
    changes.push(`status → ${options.status}`);
  }

  if (changes.length === 0) {
    console.log("No changes specified.");
    return;
  }

  const content = serializeWorkspaceFile(swarm);
  await writeFile(swarm.filePath, content, "utf-8");

  console.log(`Updated swarm "${swarmSlug}": ${changes.join(", ")}`);
}
