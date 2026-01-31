/**
 * awp sync — Workspace synchronization commands.
 *
 * Manages remote workspaces, pulls/pushes artifacts and reputation
 * signals between AWP workspaces.
 */

import {
  SyncEngine,
  addRemote,
  removeRemote,
  listRemotes,
  loadSyncState,
  listConflicts,
  resolveConflict,
} from "@agent-workspace/sync";
import type { SyncRemote, SyncOptions } from "@agent-workspace/sync";
import { requireWorkspaceRoot } from "../lib/cli-utils.js";

// --- awp sync remote add ---

export async function syncRemoteAddCommand(
  name: string,
  url: string,
  options: { transport?: string }
): Promise<void> {
  const root = await requireWorkspaceRoot();
  const transport = (options.transport || "local-fs") as SyncRemote["transport"];

  if (transport !== "local-fs" && transport !== "git-remote") {
    console.error(`Error: Unknown transport "${transport}". Valid: local-fs, git-remote`);
    process.exit(1);
  }

  try {
    await addRemote(root, name, { url, transport });
    console.log(`Remote "${name}" added (${transport}: ${url})`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// --- awp sync remote list ---

export async function syncRemoteListCommand(): Promise<void> {
  const root = await requireWorkspaceRoot();
  const remotes = await listRemotes(root);

  if (Object.keys(remotes).length === 0) {
    console.log("No remotes configured. Use 'awp sync remote add <name> <url>' to add one.");
    return;
  }

  for (const [name, remote] of Object.entries(remotes)) {
    const lastSync = remote.lastSync ? new Date(remote.lastSync).toLocaleString() : "never";
    console.log(`  ${name}\t${remote.transport}\t${remote.url}\t(last sync: ${lastSync})`);
  }
}

// --- awp sync remote remove ---

export async function syncRemoteRemoveCommand(name: string): Promise<void> {
  const root = await requireWorkspaceRoot();

  try {
    await removeRemote(root, name);
    console.log(`Remote "${name}" removed.`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// --- awp sync pull ---

export async function syncPullCommand(
  remote: string,
  options: { slug?: string; tag?: string; dryRun?: boolean; noAutoMerge?: boolean }
): Promise<void> {
  const root = await requireWorkspaceRoot();
  const engine = new SyncEngine(root);

  const syncOptions: SyncOptions = {
    slugPattern: options.slug,
    tag: options.tag,
    dryRun: options.dryRun,
    noAutoMerge: options.noAutoMerge,
  };

  try {
    const result = await engine.pull(remote, syncOptions);

    if (options.dryRun) {
      console.log("Dry run — no changes applied:\n");
    }

    if (result.imported.length > 0) {
      console.log(`  Imported: ${result.imported.join(", ")}`);
    }
    if (result.updated.length > 0) {
      console.log(`  Updated:  ${result.updated.join(", ")}`);
    }
    if (result.conflicts.length > 0) {
      console.log(`  Conflicts: ${result.conflicts.join(", ")}`);
    }
    if (result.skipped.length > 0) {
      console.log(`  Skipped:  ${result.skipped.join(", ")}`);
    }

    const total = result.imported.length + result.updated.length;
    if (total === 0 && result.conflicts.length === 0) {
      console.log("Already up to date.");
    } else if (!options.dryRun) {
      console.log(`\nPulled ${total} artifact(s) from "${remote}".`);
      if (result.conflicts.length > 0) {
        console.log(`${result.conflicts.length} conflict(s) — use 'awp sync conflicts' to review.`);
      }
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// --- awp sync push ---

export async function syncPushCommand(
  remote: string,
  options: { slug?: string; dryRun?: boolean }
): Promise<void> {
  const root = await requireWorkspaceRoot();
  const engine = new SyncEngine(root);

  const syncOptions: SyncOptions = {
    slugPattern: options.slug,
    dryRun: options.dryRun,
  };

  try {
    const result = await engine.push(remote, syncOptions);

    if (options.dryRun) {
      console.log("Dry run — no changes applied:\n");
    }

    if (result.updated.length > 0) {
      console.log(`  Pushed: ${result.updated.join(", ")}`);
    }
    if (result.conflicts.length > 0) {
      console.log(`  Conflicts: ${result.conflicts.join(", ")}`);
    }
    if (result.skipped.length > 0) {
      console.log(`  Skipped: ${result.skipped.join(", ")}`);
    }

    if (result.updated.length === 0 && result.conflicts.length === 0) {
      console.log("Nothing to push.");
    } else if (!options.dryRun) {
      console.log(`\nPushed ${result.updated.length} artifact(s) to "${remote}".`);
    }
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// --- awp sync diff ---

export async function syncDiffCommand(
  remote: string,
  options: { direction?: string }
): Promise<void> {
  const root = await requireWorkspaceRoot();
  const engine = new SyncEngine(root);
  const direction = (options.direction || "pull") as "pull" | "push";

  try {
    const entries = await engine.diff(remote, direction);

    if (entries.length === 0) {
      console.log(`No differences with "${remote}" (${direction}).`);
      return;
    }

    for (const entry of entries) {
      const versions = `v${entry.localVersion ?? "?"} → v${entry.remoteVersion ?? "?"}`;
      console.log(`  ${entry.action.padEnd(14)} ${entry.slug.padEnd(30)} ${versions}`);
    }

    console.log(`\n${entries.length} difference(s).`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// --- awp sync status ---

export async function syncStatusCommand(remoteName?: string): Promise<void> {
  const root = await requireWorkspaceRoot();
  const remotes = await listRemotes(root);

  if (Object.keys(remotes).length === 0) {
    console.log("No remotes configured.");
    return;
  }

  const names = remoteName ? [remoteName] : Object.keys(remotes);

  for (const name of names) {
    const remote = remotes[name];
    if (!remote) {
      console.error(`Remote "${name}" not found.`);
      continue;
    }

    const state = await loadSyncState(root, name);
    const artifactCount = Object.keys(state.artifacts).length;
    const lastSync = state.lastSync ? new Date(state.lastSync).toLocaleString() : "never";

    console.log(`Remote: ${name}`);
    console.log(`  URL:       ${remote.url}`);
    console.log(`  Transport: ${remote.transport}`);
    console.log(`  Last sync: ${lastSync}`);
    console.log(`  Artifacts: ${artifactCount} tracked`);
    console.log(`  Signals:   ${state.signals.signalCount} synced`);
    console.log();
  }
}

// --- awp sync pull-signals ---

export async function syncPullSignalsCommand(
  remote: string,
  options: { since?: string }
): Promise<void> {
  const root = await requireWorkspaceRoot();
  const engine = new SyncEngine(root);

  try {
    const imported = await engine.pullSignals(remote, options.since);
    console.log(`Imported ${imported} reputation signal(s) from "${remote}".`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// --- awp sync push-signals ---

export async function syncPushSignalsCommand(remote: string): Promise<void> {
  const root = await requireWorkspaceRoot();
  const engine = new SyncEngine(root);

  try {
    const pushed = await engine.pushSignals(remote);
    console.log(`Pushed ${pushed} reputation signal(s) to "${remote}".`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}

// --- awp sync conflicts ---

export async function syncConflictsCommand(): Promise<void> {
  const root = await requireWorkspaceRoot();
  const conflicts = await listConflicts(root);

  if (conflicts.length === 0) {
    console.log("No pending conflicts.");
    return;
  }

  for (const c of conflicts) {
    console.log(`  ${c.artifact}`);
    console.log(`    Remote:   ${c.remote}`);
    console.log(`    Local:    v${c.localVersion}  Remote: v${c.remoteVersion}`);
    console.log(`    Detected: ${new Date(c.detectedAt).toLocaleString()}`);
    console.log(`    Reason:   ${c.reason}`);
    console.log();
  }

  console.log(`${conflicts.length} conflict(s). Use 'awp sync resolve <slug> --accept <mode>' to resolve.`);
}

// --- awp sync resolve ---

export async function syncResolveCommand(
  slug: string,
  options: { accept?: string }
): Promise<void> {
  const root = await requireWorkspaceRoot();
  const mode = (options.accept || "local") as "local" | "remote" | "merged";

  if (!["local", "remote", "merged"].includes(mode)) {
    console.error(`Error: Invalid mode "${mode}". Valid: local, remote, merged`);
    process.exit(1);
  }

  try {
    await resolveConflict(root, slug, mode);
    console.log(`Conflict for "${slug}" resolved (${mode}).`);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}
