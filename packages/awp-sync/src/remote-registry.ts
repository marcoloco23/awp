/**
 * Remote workspace registry.
 *
 * Manages the list of known remote workspaces stored in .awp/sync/remotes.json.
 * All writes use atomic I/O with file locking for concurrent safety.
 */

import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import { SYNC_DIR, SYNC_REMOTES_FILE } from "@agent-workspace/core";
import { safeWriteJson, loadJsonFile, withFileLock } from "@agent-workspace/utils";
import type { SyncRemote, RemoteRegistry } from "./types.js";

/** Load the remote registry from a workspace, returning an empty registry if none exists */
async function loadRegistry(workspace: string): Promise<RemoteRegistry> {
  const filePath = join(workspace, SYNC_REMOTES_FILE);
  const data = await loadJsonFile<RemoteRegistry>(filePath);
  return data ?? { version: 1, remotes: {} };
}

/** Save the remote registry to a workspace */
async function saveRegistry(workspace: string, registry: RemoteRegistry): Promise<void> {
  const syncDir = join(workspace, SYNC_DIR);
  await mkdir(syncDir, { recursive: true });
  const filePath = join(workspace, SYNC_REMOTES_FILE);
  await safeWriteJson(filePath, registry);
}

/**
 * Add a remote workspace.
 * @throws if a remote with the same name already exists
 */
export async function addRemote(
  workspace: string,
  name: string,
  remote: Omit<SyncRemote, "added" | "lastSync">
): Promise<SyncRemote> {
  const filePath = join(workspace, SYNC_REMOTES_FILE);

  return withFileLock(filePath, async () => {
    const registry = await loadRegistry(workspace);

    if (registry.remotes[name]) {
      throw new Error(`Remote "${name}" already exists. Remove it first with removeRemote().`);
    }

    const entry: SyncRemote = {
      ...remote,
      added: new Date().toISOString(),
      lastSync: null,
    };

    registry.remotes[name] = entry;
    await saveRegistry(workspace, registry);
    return entry;
  });
}

/**
 * Remove a remote workspace.
 * @throws if the remote does not exist
 */
export async function removeRemote(workspace: string, name: string): Promise<void> {
  const filePath = join(workspace, SYNC_REMOTES_FILE);

  await withFileLock(filePath, async () => {
    const registry = await loadRegistry(workspace);

    if (!registry.remotes[name]) {
      throw new Error(`Remote "${name}" not found.`);
    }

    delete registry.remotes[name];
    await saveRegistry(workspace, registry);
  });
}

/**
 * List all configured remotes.
 */
export async function listRemotes(workspace: string): Promise<Record<string, SyncRemote>> {
  const registry = await loadRegistry(workspace);
  return registry.remotes;
}

/**
 * Get a specific remote by name.
 * @returns the remote or undefined if not found
 */
export async function getRemote(workspace: string, name: string): Promise<SyncRemote | undefined> {
  const registry = await loadRegistry(workspace);
  return registry.remotes[name];
}

/**
 * Update the lastSync timestamp for a remote.
 */
export async function touchRemoteSync(workspace: string, name: string): Promise<void> {
  const filePath = join(workspace, SYNC_REMOTES_FILE);

  await withFileLock(filePath, async () => {
    const registry = await loadRegistry(workspace);
    const remote = registry.remotes[name];
    if (!remote) throw new Error(`Remote "${name}" not found.`);

    remote.lastSync = new Date().toISOString();
    await saveRegistry(workspace, registry);
  });
}
