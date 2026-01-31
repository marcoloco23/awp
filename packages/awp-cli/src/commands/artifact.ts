import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AWP_VERSION, SMP_VERSION, ARTIFACTS_DIR } from "@agent-workspace/core";
import type { ArtifactFrontmatter, ProvenanceEntry } from "@agent-workspace/core";
import { findWorkspaceRoot } from "../lib/workspace.js";
import { writeWorkspaceFile } from "../lib/frontmatter.js";
import {
  validateSlug,
  idFromSlug,
  slugFromId,
  slugToPath,
  loadArtifact,
  listArtifacts,
  getAgentDid,
} from "../lib/artifact.js";
import { listProfiles, computeDecayedScore } from "../lib/reputation.js";

// --- awp artifact create ---

export async function artifactCreateCommand(
  slug: string,
  options: { title?: string; tags?: string; confidence?: number }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  if (!validateSlug(slug)) {
    console.error(`Error: Invalid slug "${slug}". Must match [a-z0-9][a-z0-9-]*`);
    process.exit(1);
  }

  // Ensure artifacts directory exists
  await mkdir(join(root, ARTIFACTS_DIR), { recursive: true });

  // Check if artifact already exists
  try {
    await loadArtifact(root, slug);
    console.error(`Error: Artifact "${slug}" already exists.`);
    process.exit(1);
  } catch {
    // Good — doesn't exist yet
  }

  const did = await getAgentDid(root);
  const now = new Date().toISOString();
  const title =
    options.title ||
    slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  const tags = options.tags ? options.tags.split(",").map((t) => t.trim()) : undefined;

  const frontmatter: ArtifactFrontmatter = {
    awp: AWP_VERSION,
    smp: SMP_VERSION,
    type: "knowledge-artifact",
    id: idFromSlug(slug),
    title,
    authors: [did],
    version: 1,
    confidence: options.confidence,
    tags,
    created: now,
    lastModified: now,
    modifiedBy: did,
    provenance: [
      {
        agent: did,
        action: "created",
        timestamp: now,
      },
    ],
  };

  const filePath = slugToPath(root, slug);
  await writeWorkspaceFile({
    frontmatter,
    body: `\n# ${title}\n\n`,
    filePath,
  });

  console.log(`Created artifacts/${slug}.md (version 1)`);
}

// --- awp artifact commit ---

export async function artifactCommitCommand(
  slug: string,
  options: { message?: string; confidence?: number }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  let artifact;
  try {
    artifact = await loadArtifact(root, slug);
  } catch {
    console.error(`Error: Artifact "${slug}" not found.`);
    process.exit(1);
    return;
  }

  const did = await getAgentDid(root);
  const now = new Date().toISOString();
  const fm = artifact.frontmatter;

  fm.version += 1;
  fm.lastModified = now;
  fm.modifiedBy = did;

  if (options.confidence !== undefined) {
    fm.confidence = options.confidence;
  }

  // Add author if not already present
  if (!fm.authors.includes(did)) {
    fm.authors.push(did);
  }

  const entry: ProvenanceEntry = {
    agent: did,
    action: "updated",
    timestamp: now,
    message: options.message,
    confidence: options.confidence,
  };
  fm.provenance.push(entry);

  await writeWorkspaceFile(artifact);
  console.log(`Committed artifacts/${slug}.md (version ${fm.version})`);
}

// --- awp artifact log ---

export async function artifactLogCommand(slug: string): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  let artifact;
  try {
    artifact = await loadArtifact(root, slug);
  } catch {
    console.error(`Error: Artifact "${slug}" not found.`);
    process.exit(1);
    return;
  }

  const fm = artifact.frontmatter;
  const confStr = fm.confidence !== undefined ? `, confidence: ${fm.confidence}` : "";
  console.log(`${fm.title} (version ${fm.version}${confStr})`);
  console.log("");

  // Print provenance in reverse chronological order
  const entries = [...fm.provenance].reverse();
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const version = fm.provenance.length - i;
    const msg = e.message ? `  "${e.message}"` : "";
    console.log(`  v${version}  ${e.timestamp}  ${e.agent}  ${e.action}${msg}`);
  }
}

// --- awp artifact list ---

export async function artifactListCommand(options: { tag?: string }): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  let artifacts = await listArtifacts(root);

  if (options.tag) {
    const tag = options.tag.toLowerCase();
    artifacts = artifacts.filter((a) => a.frontmatter.tags?.some((t) => t.toLowerCase() === tag));
  }

  if (artifacts.length === 0) {
    console.log("No artifacts found.");
    return;
  }

  // Print header
  const slugW = 28;
  const titleW = 36;
  console.log(
    `${"SLUG".padEnd(slugW)}${"TITLE".padEnd(titleW)}${"V".padEnd(4)}${"CONF".padEnd(6)}TAGS`
  );

  for (const a of artifacts) {
    const fm = a.frontmatter;
    const slug = slugFromId(fm.id);
    const title = fm.title.length > titleW - 2 ? fm.title.slice(0, titleW - 4) + ".." : fm.title;
    const conf = fm.confidence !== undefined ? fm.confidence.toFixed(2) : "-";
    const tags = fm.tags?.join(", ") || "";
    console.log(
      `${slug.padEnd(slugW)}${title.padEnd(titleW)}${String(fm.version).padEnd(4)}${conf.padEnd(6)}${tags}`
    );
  }
}

// --- awp artifact search ---

export async function artifactSearchCommand(query: string): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  const artifacts = await listArtifacts(root);
  const queryLower = query.toLowerCase();
  let found = 0;

  for (const a of artifacts) {
    const fm = a.frontmatter;
    const titleMatch = fm.title.toLowerCase().includes(queryLower);
    const tagMatch = fm.tags?.some((t) => t.toLowerCase().includes(queryLower));
    const bodyMatch = a.body.toLowerCase().includes(queryLower);

    if (titleMatch || tagMatch || bodyMatch) {
      const slug = slugFromId(fm.id);
      const confStr = fm.confidence !== undefined ? ` (confidence: ${fm.confidence})` : "";
      console.log(`\n${slug}: ${fm.title} [v${fm.version}]${confStr}`);

      if (bodyMatch && !titleMatch) {
        // Show a snippet of the matching body content
        const idx = a.body.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, idx - 40);
        const end = Math.min(a.body.length, idx + queryLower.length + 40);
        const snippet = a.body.slice(start, end).replace(/\n/g, " ").trim();
        console.log(`  ...${snippet}...`);
      }

      found++;
    }
  }

  if (found === 0) {
    console.log(`No artifacts matching "${query}".`);
  } else {
    console.log(`\n${found} matching artifact(s).`);
  }
}

// --- awp artifact merge ---

/**
 * Look up the domain reputation score for an agent DID.
 * Scans all reputation profiles to find one matching the DID,
 * then returns the highest decayed domainCompetence score for
 * any of the given tags.
 */
async function getAuthorityScore(
  root: string,
  authorDid: string,
  sharedTags: string[],
  now: Date
): Promise<{ score: number; slug: string | null }> {
  const profiles = await listProfiles(root);

  // Find a profile matching this DID
  const profile = profiles.find((p) => p.frontmatter.agentDid === authorDid);
  if (!profile) return { score: 0, slug: null };

  const fm = profile.frontmatter;
  const slug = fm.id.replace("reputation:", "");
  let bestScore = 0;

  // Check domainCompetence for any shared tag
  for (const tag of sharedTags) {
    const dim = fm.domainCompetence?.[tag];
    if (dim) {
      const decayed = computeDecayedScore(dim, now);
      if (decayed > bestScore) bestScore = decayed;
    }
  }

  // If no domain match, fall back to general reliability
  if (bestScore === 0 && fm.dimensions?.reliability) {
    bestScore = computeDecayedScore(fm.dimensions.reliability, now);
  }

  return { score: bestScore, slug };
}

export async function artifactMergeCommand(
  targetSlug: string,
  sourceSlug: string,
  options: { message?: string; strategy?: string }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  const strategy = options.strategy || "additive";
  if (strategy !== "additive" && strategy !== "authority") {
    console.error(`Error: Unknown merge strategy "${strategy}". Use "additive" or "authority".`);
    process.exit(1);
  }

  let target, source;
  try {
    target = await loadArtifact(root, targetSlug);
  } catch {
    console.error(`Error: Target artifact "${targetSlug}" not found.`);
    process.exit(1);
    return;
  }

  try {
    source = await loadArtifact(root, sourceSlug);
  } catch {
    console.error(`Error: Source artifact "${sourceSlug}" not found.`);
    process.exit(1);
    return;
  }

  const did = await getAgentDid(root);
  const now = new Date();
  const nowIso = now.toISOString();
  const tfm = target.frontmatter;
  const sfm = source.frontmatter;

  if (strategy === "authority") {
    // Authority merge: use reputation to determine ordering
    const sharedTags = (tfm.tags ?? []).filter((t) => (sfm.tags ?? []).includes(t));

    if (sharedTags.length === 0) {
      console.log("Warning: No shared tags between artifacts. Using reliability dimension as fallback.");
    }

    const targetAuthor = tfm.authors[0] || "anonymous";
    const sourceAuthor = sfm.authors[0] || "anonymous";

    const targetAuth = await getAuthorityScore(root, targetAuthor, sharedTags, now);
    const sourceAuth = await getAuthorityScore(root, sourceAuthor, sharedTags, now);

    // Determine who is higher-authority
    const targetIsHigher = targetAuth.score >= sourceAuth.score;
    const higherBody = targetIsHigher ? target.body.trim() : source.body.trim();
    const lowerBody = targetIsHigher ? source.body.trim() : target.body.trim();
    const lowerAuthor = targetIsHigher ? sourceAuthor : targetAuthor;
    const lowerScore = targetIsHigher ? sourceAuth.score : targetAuth.score;
    const higherScore = targetIsHigher ? targetAuth.score : sourceAuth.score;

    target.body =
      higherBody +
      `\n\n---\n*Authority merge: content below from ${lowerAuthor}` +
      ` (authority score: ${lowerScore.toFixed(2)} vs ${higherScore.toFixed(2)})*\n\n` +
      lowerBody +
      "\n";

    console.log(
      `Authority merge: ${targetIsHigher ? "target" : "source"} has higher authority` +
        ` (${higherScore.toFixed(2)} vs ${lowerScore.toFixed(2)})`
    );
  } else {
    // Additive merge (original behavior)
    const separator = `\n---\n*Merged from ${sfm.id} (version ${sfm.version}) on ${nowIso}*\n\n`;
    target.body += separator + source.body.trim() + "\n";
  }

  // Union authors
  for (const author of sfm.authors) {
    if (!tfm.authors.includes(author)) {
      tfm.authors.push(author);
    }
  }
  if (!tfm.authors.includes(did)) {
    tfm.authors.push(did);
  }

  // Union tags
  if (sfm.tags) {
    if (!tfm.tags) tfm.tags = [];
    for (const tag of sfm.tags) {
      if (!tfm.tags.includes(tag)) {
        tfm.tags.push(tag);
      }
    }
  }

  // Confidence: take the minimum (conservative)
  if (tfm.confidence !== undefined && sfm.confidence !== undefined) {
    tfm.confidence = Math.min(tfm.confidence, sfm.confidence);
  } else if (sfm.confidence !== undefined) {
    tfm.confidence = sfm.confidence;
  }

  // Bump version and provenance
  tfm.version += 1;
  tfm.lastModified = nowIso;
  tfm.modifiedBy = did;

  const msg =
    options.message || `Merged from ${sfm.id} (version ${sfm.version}, strategy: ${strategy})`;
  tfm.provenance.push({
    agent: did,
    action: "merged",
    timestamp: nowIso,
    message: msg,
    confidence: tfm.confidence,
  });

  await writeWorkspaceFile(target);
  console.log(
    `Merged ${sfm.id} into ${tfm.id} (now version ${tfm.version}, strategy: ${strategy})`
  );
}
