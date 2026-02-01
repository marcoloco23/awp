import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import { getWorkspaceRoot } from "@agent-workspace/utils";
import {
  SyncEngine,
  addRemote,
  removeRemote,
  listRemotes,
  loadSyncState,
  listConflicts,
  resolveConflict,
} from "@agent-workspace/sync";
import type { SyncRemote } from "@agent-workspace/sync";

/**
 * Register sync-related tools.
 */
export function registerSyncTools(server: McpServer): void {
  // --- Tool: awp_sync_remote_list ---
  server.registerTool(
    "awp_sync_remote_list",
    {
      title: "List Sync Remotes",
      description: "List all configured remote workspaces for sync.",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const remotes = await listRemotes(root);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ remotes }, null, 2) }],
      };
    }
  );

  // --- Tool: awp_sync_remote_add ---
  server.registerTool(
    "awp_sync_remote_add",
    {
      title: "Add Sync Remote",
      description: "Add a remote workspace for sync. Supports local-fs and git-remote transports.",
      inputSchema: {
        name: z.string().describe("Remote name (e.g., origin)"),
        url: z.string().describe("Remote URL or filesystem path"),
        transport: z
          .enum(["local-fs", "git-remote"])
          .optional()
          .default("local-fs")
          .describe("Transport type"),
      },
    },
    async ({ name, url, transport }) => {
      const root = getWorkspaceRoot();
      await addRemote(root, name, {
        url,
        transport: transport as SyncRemote["transport"],
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, remote: name, url, transport }, null, 2),
          },
        ],
      };
    }
  );

  // --- Tool: awp_sync_remote_remove ---
  server.registerTool(
    "awp_sync_remote_remove",
    {
      title: "Remove Sync Remote",
      description: "Remove a configured remote workspace.",
      inputSchema: {
        name: z.string().describe("Remote name to remove"),
      },
    },
    async ({ name }) => {
      const root = getWorkspaceRoot();
      await removeRemote(root, name);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ success: true, removed: name }, null, 2) },
        ],
      };
    }
  );

  // --- Tool: awp_sync_pull ---
  server.registerTool(
    "awp_sync_pull",
    {
      title: "Sync Pull",
      description:
        "Pull artifacts from a remote workspace. Supports slug patterns, tag filters, dry-run mode, and auto-merge control.",
      inputSchema: {
        remote: z.string().describe("Remote name"),
        slugPattern: z.string().optional().describe("Filter by slug pattern (supports * wildcards)"),
        tag: z.string().optional().describe("Filter by tag"),
        dryRun: z.boolean().optional().default(false).describe("Preview changes without applying"),
        noAutoMerge: z
          .boolean()
          .optional()
          .default(false)
          .describe("Create conflict files instead of auto-merging"),
      },
    },
    async ({ remote, slugPattern, tag, dryRun, noAutoMerge }) => {
      const root = getWorkspaceRoot();
      const engine = new SyncEngine(root);
      const result = await engine.pull(remote, { slugPattern, tag, dryRun, noAutoMerge });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // --- Tool: awp_sync_push ---
  server.registerTool(
    "awp_sync_push",
    {
      title: "Sync Push",
      description: "Push artifacts to a remote workspace.",
      inputSchema: {
        remote: z.string().describe("Remote name"),
        slugPattern: z.string().optional().describe("Filter by slug pattern (supports * wildcards)"),
        dryRun: z.boolean().optional().default(false).describe("Preview changes without applying"),
      },
    },
    async ({ remote, slugPattern, dryRun }) => {
      const root = getWorkspaceRoot();
      const engine = new SyncEngine(root);
      const result = await engine.push(remote, { slugPattern, dryRun });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );

  // --- Tool: awp_sync_diff ---
  server.registerTool(
    "awp_sync_diff",
    {
      title: "Sync Diff",
      description: "Show differences between local and remote artifacts without applying changes.",
      inputSchema: {
        remote: z.string().describe("Remote name"),
        direction: z
          .enum(["pull", "push"])
          .optional()
          .default("pull")
          .describe("Diff direction"),
      },
    },
    async ({ remote, direction }) => {
      const root = getWorkspaceRoot();
      const engine = new SyncEngine(root);
      const entries = await engine.diff(remote, direction);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ entries }, null, 2) }],
      };
    }
  );

  // --- Tool: awp_sync_status ---
  server.registerTool(
    "awp_sync_status",
    {
      title: "Sync Status",
      description:
        "Show sync status for one or all remotes, including last sync time and tracked artifact/signal counts.",
      inputSchema: {
        remote: z.string().optional().describe("Remote name (omit to show all)"),
      },
    },
    async ({ remote: remoteName }) => {
      const root = getWorkspaceRoot();
      const remotes = await listRemotes(root);
      const names = remoteName ? [remoteName] : Object.keys(remotes);
      const statuses: Record<string, unknown>[] = [];

      for (const name of names) {
        const rem = remotes[name];
        if (!rem) continue;
        const state = await loadSyncState(root, name);
        statuses.push({
          name,
          url: rem.url,
          transport: rem.transport,
          lastSync: state.lastSync,
          trackedArtifacts: Object.keys(state.artifacts).length,
          signalsSynced: state.signals.signalCount,
        });
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ remotes: statuses }, null, 2) }],
      };
    }
  );

  // --- Tool: awp_sync_conflicts ---
  server.registerTool(
    "awp_sync_conflicts",
    {
      title: "Sync Conflicts",
      description: "List pending sync conflicts that need resolution.",
      inputSchema: {},
    },
    async () => {
      const root = getWorkspaceRoot();
      const conflicts = await listConflicts(root);
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ conflicts }, null, 2) }],
      };
    }
  );

  // --- Tool: awp_sync_resolve ---
  server.registerTool(
    "awp_sync_resolve",
    {
      title: "Resolve Sync Conflict",
      description:
        "Resolve a sync conflict. 'local' keeps current version, 'remote' overwrites with remote version, 'merged' assumes manual edit was done.",
      inputSchema: {
        slug: z.string().describe("Artifact slug with the conflict"),
        mode: z
          .enum(["local", "remote", "merged"])
          .optional()
          .default("local")
          .describe("Resolution mode"),
      },
    },
    async ({ slug, mode }) => {
      const root = getWorkspaceRoot();
      await resolveConflict(root, slug, mode);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, slug, mode }, null, 2),
          },
        ],
      };
    }
  );

  // --- Tool: awp_sync_pull_signals ---
  server.registerTool(
    "awp_sync_pull_signals",
    {
      title: "Pull Reputation Signals",
      description:
        "Pull reputation signals from a remote workspace. Signals are de-duplicated and merged into local reputation profiles using EWMA scoring.",
      inputSchema: {
        remote: z.string().describe("Remote name"),
        since: z
          .string()
          .optional()
          .describe("Only pull signals after this ISO timestamp (default: last sync time)"),
      },
    },
    async ({ remote, since }) => {
      const root = getWorkspaceRoot();
      const engine = new SyncEngine(root);
      const imported = await engine.pullSignals(remote, since);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, remote, imported }, null, 2),
          },
        ],
      };
    }
  );

  // --- Tool: awp_sync_push_signals ---
  server.registerTool(
    "awp_sync_push_signals",
    {
      title: "Push Reputation Signals",
      description:
        "Push local reputation signals to a remote workspace. Currently supports local-fs transport only.",
      inputSchema: {
        remote: z.string().describe("Remote name"),
      },
    },
    async ({ remote }) => {
      const root = getWorkspaceRoot();
      const engine = new SyncEngine(root);
      const pushed = await engine.pushSignals(remote);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, remote, pushed }, null, 2),
          },
        ],
      };
    }
  );
}
