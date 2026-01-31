/**
 * Conflict resolution for sync operations.
 *
 * When auto-merge fails or is disabled, stashes the remote copy
 * and creates a conflict descriptor for manual resolution.
 */

import { readFile, readdir, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { SYNC_CONFLICTS_DIR, ARTIFACTS_DIR } from "@agent-workspace/core";
import { atomicWriteFile, safeWriteJson, loadJsonFile } from "@agent-workspace/utils";
import type { ConflictDescriptor } from "./types.js";

/**
 * Stash a remote artifact copy and create a conflict descriptor.
 */
export async function stashConflict(
  workspace: string,
  slug: string,
  remoteName: string,
  localVersion: number,
  remoteVersion: number,
  remoteContent: string,
  strategy: string,
  reason: string
): Promise<ConflictDescriptor> {
  const conflictsDir = join(workspace, SYNC_CONFLICTS_DIR);
  await mkdir(conflictsDir, { recursive: true });

  const remoteCopyPath = join(conflictsDir, `${slug}.remote.md`);
  const descriptorPath = join(conflictsDir, `${slug}.conflict.json`);

  // Stash the remote copy
  await atomicWriteFile(remoteCopyPath, remoteContent);

  const descriptor: ConflictDescriptor = {
    artifact: slug,
    remote: remoteName,
    localVersion,
    remoteVersion,
    detectedAt: new Date().toISOString(),
    strategy,
    reason,
    localPath: join(ARTIFACTS_DIR, `${slug}.md`),
    remoteCopyPath: join(SYNC_CONFLICTS_DIR, `${slug}.remote.md`),
  };

  await safeWriteJson(descriptorPath, descriptor);
  return descriptor;
}

/**
 * List all pending sync conflicts.
 */
export async function listConflicts(workspace: string): Promise<ConflictDescriptor[]> {
  const conflictsDir = join(workspace, SYNC_CONFLICTS_DIR);
  const conflicts: ConflictDescriptor[] = [];

  let files: string[];
  try {
    files = await readdir(conflictsDir);
  } catch {
    return [];
  }

  for (const file of files) {
    if (!file.endsWith(".conflict.json")) continue;
    const descriptor = await loadJsonFile<ConflictDescriptor>(join(conflictsDir, file));
    if (descriptor) conflicts.push(descriptor);
  }

  return conflicts;
}

/**
 * Resolve a sync conflict.
 *
 * @param mode - "local" keeps local version, "remote" overwrites with remote, "merged" assumes user already edited local
 */
export async function resolveConflict(
  workspace: string,
  slug: string,
  mode: "local" | "remote" | "merged"
): Promise<void> {
  const conflictsDir = join(workspace, SYNC_CONFLICTS_DIR);
  const descriptorPath = join(conflictsDir, `${slug}.conflict.json`);
  const remoteCopyPath = join(conflictsDir, `${slug}.remote.md`);

  const descriptor = await loadJsonFile<ConflictDescriptor>(descriptorPath);
  if (!descriptor) {
    throw new Error(`No conflict found for artifact "${slug}"`);
  }

  if (mode === "remote") {
    // Overwrite local with the stashed remote copy
    const remoteContent = await readFile(remoteCopyPath, "utf-8");
    const localPath = join(workspace, ARTIFACTS_DIR, `${slug}.md`);
    await atomicWriteFile(localPath, remoteContent);
  }
  // "local" and "merged" both keep the current local file as-is

  // Cleanup conflict files
  try {
    await unlink(descriptorPath);
  } catch {
    /* already cleaned */
  }
  try {
    await unlink(remoteCopyPath);
  } catch {
    /* already cleaned */
  }
}
