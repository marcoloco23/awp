import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateKeyPairSync, createPublicKey } from "node:crypto";
import { AWP_VERSION, MANIFEST_PATH, type AgentCard } from "@agent-workspace/core";
import { findWorkspaceRoot, loadManifest } from "../lib/workspace.js";
import { parseWorkspaceFile, writeWorkspaceFile } from "../lib/frontmatter.js";
import type { IdentityFrontmatter, SoulFrontmatter } from "@agent-workspace/core";

/**
 * Generate a did:key identifier from an Ed25519 public key
 */
function generateDidKey(): { did: string; publicKeyMultibase: string; privateKeyPem: string } {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");

  // Export raw public key bytes
  const pubKeyDer = publicKey.export({ type: "spki", format: "der" });
  // Ed25519 SPKI DER has 12 bytes of header, raw key is the last 32 bytes
  const rawPubKey = pubKeyDer.subarray(pubKeyDer.length - 32);

  // Multibase: 'z' prefix = base58btc
  // Multicodec: 0xed01 = Ed25519 public key
  const multicodecPrefix = Buffer.from([0xed, 0x01]);
  const fullKey = Buffer.concat([multicodecPrefix, rawPubKey]);

  // Simple base58btc encoding (using base64url as a practical substitute)
  const encoded = fullKey.toString("base64url");
  const did = `did:key:z${encoded}`;
  const publicKeyMultibase = `z${encoded}`;

  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

  return { did, publicKeyMultibase, privateKeyPem };
}

export async function identityGenerateCommand(): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace. Run 'awp init' to create one.");
    process.exit(1);
  }

  const manifest = await loadManifest(root);

  if (manifest.agent.did) {
    console.log(`Agent already has a DID: ${manifest.agent.did}`);
    console.log("To regenerate, remove the 'did' field from .awp/workspace.json first.");
    return;
  }

  console.log("Generating Ed25519 key pair...");
  const { did, publicKeyMultibase, privateKeyPem } = generateDidKey();

  // Update manifest
  manifest.agent.did = did;
  await writeFile(
    join(root, MANIFEST_PATH),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8"
  );
  console.log(`  Updated ${MANIFEST_PATH}`);

  // Update IDENTITY.md frontmatter
  try {
    const identityPath = join(root, "IDENTITY.md");
    const file = await parseWorkspaceFile<IdentityFrontmatter>(identityPath);
    file.frontmatter.did = did;
    file.frontmatter.lastModified = new Date().toISOString();
    await writeWorkspaceFile(file);
    console.log("  Updated IDENTITY.md");
  } catch {
    console.log("  (Could not update IDENTITY.md — update manually)");
  }

  // Save private key
  const keyPath = join(root, ".awp", "private-key.pem");
  await writeFile(keyPath, privateKeyPem, "utf-8");
  console.log(`  Saved private key to .awp/private-key.pem`);

  console.log("");
  console.log(`DID: ${did}`);
  console.log(`Public Key (multibase): ${publicKeyMultibase}`);
  console.log("");
  console.log("IMPORTANT: Add .awp/private-key.pem to .gitignore!");
}

export async function identityExportCommand(
  options: { format?: string }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Error: Not in an AWP workspace.");
    process.exit(1);
  }

  const manifest = await loadManifest(root);
  let identity: IdentityFrontmatter | null = null;

  try {
    const identityPath = join(root, "IDENTITY.md");
    const file = await parseWorkspaceFile<IdentityFrontmatter>(identityPath);
    identity = file.frontmatter;
  } catch {
    console.error("Error: Could not read IDENTITY.md");
    process.exit(1);
  }

  if (!identity) {
    process.exit(1);
    return;
  }

  // Read SOUL.md for vibe (personality description used as Agent Card description)
  let vibe: string | undefined;
  try {
    const soulPath = join(root, "SOUL.md");
    const soulFile = await parseWorkspaceFile<SoulFrontmatter>(soulPath);
    vibe = soulFile.frontmatter.vibe;
  } catch {
    // SOUL.md is optional for card export
  }

  const card: AgentCard = {
    name: identity.name,
    description: vibe || undefined,
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    skills: (identity.capabilities || []).map((cap) => ({
      id: cap,
      name: cap.charAt(0).toUpperCase() + cap.slice(1).replace(/-/g, " "),
    })),
    authentication: manifest.agent.did
      ? { schemes: [manifest.agent.did.split(":").slice(0, 2).join(":")] }
      : undefined,
  };

  if (options.format === "json" || !options.format) {
    console.log(JSON.stringify(card, null, 2));
  } else {
    console.error(`Unknown format: ${options.format}`);
    process.exit(1);
  }
}
