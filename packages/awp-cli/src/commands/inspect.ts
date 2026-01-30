import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { findWorkspaceRoot, inspectWorkspace } from "../lib/workspace.js";
import { parseWorkspaceFile } from "../lib/frontmatter.js";
import type { IdentityFrontmatter, SoulFrontmatter } from "@agent-workspace/core";

export async function inspectCommand(): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error(
      "Error: Not in an AWP workspace. Run 'awp init' to create one."
    );
    process.exit(1);
  }

  const info = await inspectWorkspace(root);

  console.log("AWP Workspace");
  console.log("=============");
  console.log(`  Root:     ${info.root}`);
  console.log(`  Name:     ${info.manifest.name}`);
  console.log(`  ID:       ${info.manifest.id}`);
  console.log(`  AWP:      ${info.manifest.awp}`);
  console.log(`  Created:  ${info.manifest.created}`);

  if (info.manifest.agent.did) {
    console.log(`  DID:      ${info.manifest.agent.did}`);
  }

  // Show agent identity
  try {
    const identityPath = join(root, "IDENTITY.md");
    const identity =
      await parseWorkspaceFile<IdentityFrontmatter>(identityPath);
    const fm = identity.frontmatter;
    console.log("");
    console.log("Agent");
    console.log("-----");
    console.log(`  Name:     ${fm.name || "(not set)"}`);
    if (fm.creature) console.log(`  Creature: ${fm.creature}`);
    if (fm.emoji) console.log(`  Emoji:    ${fm.emoji}`);
    if (fm.capabilities?.length) {
      console.log(`  Skills:   ${fm.capabilities.join(", ")}`);
    }
  } catch {
    console.log("\n  (Could not read IDENTITY.md)");
  }

  // Show soul summary
  try {
    const soulPath = join(root, "SOUL.md");
    const soul = await parseWorkspaceFile<SoulFrontmatter>(soulPath);
    const sfm = soul.frontmatter;
    console.log("");
    console.log("Soul");
    console.log("----");
    if (sfm.vibe) console.log(`  Vibe:       ${sfm.vibe}`);
    if (sfm.values?.length) console.log(`  Values:     ${sfm.values.length} defined`);
    if (sfm.boundaries?.length) console.log(`  Boundaries: ${sfm.boundaries.length} defined`);
    if (sfm.governance) console.log(`  Governance: configured`);
  } catch {
    console.log("\n  (Could not read SOUL.md)");
  }

  // Show files
  console.log("");
  console.log("Files");
  console.log("-----");
  for (const f of info.files.required) {
    const status = f.exists ? (f.valid ? "OK" : "INVALID") : "MISSING";
    console.log(`  ${f.file}: ${status}`);
  }
  for (const f of info.files.optional) {
    if (f.exists) {
      console.log(`  ${f.file}: present`);
    }
  }

  // Count memory files
  try {
    const memDir = join(root, "memory");
    const files = await readdir(memDir);
    const memFiles = files.filter((f) => f.endsWith(".md"));
    console.log(`  memory/: ${memFiles.length} log(s)`);
  } catch {
    console.log("  memory/: (not created)");
  }

  // Show capabilities and protocols
  if (info.manifest.capabilities?.length) {
    console.log("");
    console.log("Capabilities");
    console.log("------------");
    info.manifest.capabilities.forEach((c) => console.log(`  - ${c}`));
  }

  if (info.manifest.protocols) {
    console.log("");
    console.log("Protocols");
    console.log("---------");
    if (info.manifest.protocols.a2a) console.log("  - A2A");
    if (info.manifest.protocols.mcp) console.log("  - MCP");
  }
}
