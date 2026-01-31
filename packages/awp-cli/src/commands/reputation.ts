import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AWP_VERSION, RDP_VERSION, REPUTATION_DIR } from "@agent-workspace/core";
import type { ReputationProfileFrontmatter, ReputationSignal } from "@agent-workspace/core";
import { findWorkspaceRoot } from "../lib/workspace.js";
import { serializeWorkspaceFile } from "../lib/frontmatter.js";
import {
  validateSlug,
  slugToProfilePath,
  loadProfile,
  listProfiles,
  computeDecayedScore,
  updateDimension,
} from "../lib/reputation.js";
import { getAgentDid } from "../lib/artifact.js";

/**
 * awp reputation query [slug]
 */
export async function reputationQueryCommand(
  slug: string | undefined,
  options: { dimension?: string; domain?: string; raw?: boolean }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  // If no slug, list all profiles
  if (!slug) {
    return reputationListCommand();
  }

  let profile;
  try {
    profile = await loadProfile(root, slug);
  } catch {
    console.error(`Reputation profile not found: ${slug}`);
    process.exit(1);
  }

  const fm = profile.frontmatter;
  const now = new Date();

  console.log(`${fm.agentName} (${fm.agentDid})`);
  console.log(`Profile: ${fm.id}`);
  console.log(`Last updated: ${fm.lastUpdated}`);
  console.log(`Signals: ${fm.signals.length}`);
  console.log("");

  // Standard dimensions
  const dims = fm.dimensions || {};
  const dimEntries = Object.entries(dims);

  if (options.dimension) {
    const dim = dims[options.dimension];
    if (!dim) {
      console.log(`No data for dimension: ${options.dimension}`);
      return;
    }
    const score = options.raw ? dim.score : computeDecayedScore(dim, now);
    console.log(`${options.dimension}:`);
    console.log(`  Score:      ${score}`);
    console.log(`  Confidence: ${dim.confidence}`);
    console.log(`  Samples:    ${dim.sampleSize}`);
    console.log(`  Last:       ${dim.lastSignal}`);
    return;
  }

  if (options.domain) {
    const domainScores = fm.domainCompetence || {};
    const dom = domainScores[options.domain];
    if (!dom) {
      console.log(`No data for domain: ${options.domain}`);
      return;
    }
    const score = options.raw ? dom.score : computeDecayedScore(dom, now);
    console.log(`Domain: ${options.domain}`);
    console.log(`  Score:      ${score}`);
    console.log(`  Confidence: ${dom.confidence}`);
    console.log(`  Samples:    ${dom.sampleSize}`);
    console.log(`  Last:       ${dom.lastSignal}`);
    return;
  }

  // Show all dimensions
  if (dimEntries.length > 0) {
    console.log("Dimensions");
    console.log("----------");
    const header = "  DIMENSION            SCORE   CONF    SAMPLES";
    console.log(header);
    for (const [name, dim] of dimEntries) {
      const score = options.raw ? dim.score : computeDecayedScore(dim, now);
      console.log(
        `  ${name.padEnd(20)} ${score.toFixed(3).padStart(5)}   ${dim.confidence.toFixed(2).padStart(5)}   ${String(dim.sampleSize).padStart(5)}`
      );
    }
    console.log("");
  }

  // Show domain competence
  const domains = fm.domainCompetence || {};
  const domainEntries = Object.entries(domains);
  if (domainEntries.length > 0) {
    console.log("Domain Competence");
    console.log("-----------------");
    const header = "  DOMAIN               SCORE   CONF    SAMPLES";
    console.log(header);
    for (const [name, dim] of domainEntries) {
      const score = options.raw ? dim.score : computeDecayedScore(dim, now);
      console.log(
        `  ${name.padEnd(20)} ${score.toFixed(3).padStart(5)}   ${dim.confidence.toFixed(2).padStart(5)}   ${String(dim.sampleSize).padStart(5)}`
      );
    }
  }
}

/**
 * awp reputation signal <slug>
 */
export async function reputationSignalCommand(
  slug: string,
  options: {
    dimension: string;
    score: string;
    domain?: string;
    evidence?: string;
    message?: string;
    agentDid?: string;
    agentName?: string;
  }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  if (!validateSlug(slug)) {
    console.error(`Invalid slug: ${slug} (must be lowercase alphanumeric + hyphens)`);
    process.exit(1);
  }

  const scoreNum = parseFloat(options.score);
  if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 1) {
    console.error("Score must be a number between 0 and 1.");
    process.exit(1);
  }

  const sourceDid = await getAgentDid(root);
  const now = new Date();
  const timestamp = now.toISOString();

  const signal: ReputationSignal = {
    source: sourceDid,
    dimension: options.dimension,
    score: scoreNum,
    timestamp,
  };
  if (options.domain) signal.domain = options.domain;
  if (options.evidence) signal.evidence = options.evidence;
  if (options.message) signal.message = options.message;

  // Try loading existing profile
  let profile;
  try {
    profile = await loadProfile(root, slug);
  } catch {
    // Profile doesn't exist — create it
    if (!options.agentDid || !options.agentName) {
      console.error("First signal for this agent — --agent-did and --agent-name are required.");
      process.exit(1);
    }

    const fm: ReputationProfileFrontmatter = {
      awp: AWP_VERSION,
      rdp: RDP_VERSION,
      type: "reputation-profile",
      id: `reputation:${slug}`,
      agentDid: options.agentDid,
      agentName: options.agentName,
      lastUpdated: timestamp,
      dimensions: {},
      domainCompetence: {},
      signals: [signal],
    };

    // Set initial dimension
    if (options.dimension === "domain-competence" && options.domain) {
      fm.domainCompetence![options.domain] = updateDimension(undefined, scoreNum, now);
    } else {
      fm.dimensions![options.dimension] = updateDimension(undefined, scoreNum, now);
    }

    const body = `# ${options.agentName} — Reputation Profile\n\nTracked since ${timestamp.split("T")[0]}.`;

    await mkdir(join(root, REPUTATION_DIR), { recursive: true });
    const filePath = slugToProfilePath(root, slug);
    const content = serializeWorkspaceFile({
      frontmatter: fm,
      body,
      filePath,
    });
    await writeFile(filePath, content, "utf-8");
    console.log(`Created reputation/${slug}.md — ${options.dimension}: ${scoreNum}`);
    return;
  }

  // Update existing profile
  const fm = profile.frontmatter;
  fm.lastUpdated = timestamp;
  fm.signals.push(signal);

  if (!fm.dimensions) fm.dimensions = {};
  if (!fm.domainCompetence) fm.domainCompetence = {};

  if (options.dimension === "domain-competence" && options.domain) {
    fm.domainCompetence[options.domain] = updateDimension(
      fm.domainCompetence[options.domain],
      scoreNum,
      now
    );
  } else {
    fm.dimensions[options.dimension] = updateDimension(
      fm.dimensions[options.dimension],
      scoreNum,
      now
    );
  }

  const content = serializeWorkspaceFile(profile);
  await writeFile(profile.filePath, content, "utf-8");
  console.log(
    `Updated reputation/${slug}.md — ${options.dimension}${options.domain ? `:${options.domain}` : ""}: ${scoreNum} (sample ${fm.dimensions[options.dimension]?.sampleSize ?? fm.domainCompetence[options.domain!]?.sampleSize})`
  );
}

/**
 * awp reputation list
 */
export async function reputationListCommand(): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  const profiles = await listProfiles(root);

  if (profiles.length === 0) {
    console.log("No reputation profiles found.");
    return;
  }

  const header = "SLUG                 AGENT                SIGNALS  DIMS     TOP SCORE";
  console.log(header);
  console.log("-".repeat(header.length));

  for (const p of profiles) {
    const fm = p.frontmatter;
    const slug = fm.id.replace("reputation:", "");
    const dims =
      Object.keys(fm.dimensions || {}).length + Object.keys(fm.domainCompetence || {}).length;

    // Find highest score
    let topScore = "—";
    let topName = "";
    for (const [name, dim] of Object.entries(fm.dimensions || {})) {
      if (!topName || dim.score > parseFloat(topScore)) {
        topScore = dim.score.toFixed(2);
        topName = name;
      }
    }
    for (const [name, dim] of Object.entries(fm.domainCompetence || {})) {
      if (!topName || dim.score > parseFloat(topScore || "0")) {
        topScore = dim.score.toFixed(2);
        topName = name;
      }
    }

    const topDisplay = topName ? `${topScore} (${topName})` : "—";

    console.log(
      `${slug.padEnd(20)} ${fm.agentName.padEnd(20)} ${String(fm.signals.length).padStart(7)}  ${String(dims).padStart(4)}     ${topDisplay}`
    );
  }
}
