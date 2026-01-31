import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSyncState, saveSyncState, computeArtifactDiff } from "./sync-state.js";
import type { LocalArtifactInfo } from "./sync-state.js";
import type { SyncState, RemoteArtifactManifest } from "./types.js";

let testDir: string;
const ts = new Date().toISOString();

function artifact(slug: string, version: number): LocalArtifactInfo {
  return { slug, version, lastModified: ts };
}

function remoteArtifact(slug: string, version: number): RemoteArtifactManifest {
  return { slug, version, lastModified: ts, authors: ["did:awp:test"] };
}

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "awp-sync-state-test-"));
  await mkdir(join(testDir, ".awp", "sync", "state"), { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("loadSyncState", () => {
  it("returns default state when no state file exists", async () => {
    const state = await loadSyncState(testDir, "origin");
    expect(state.version).toBe(1);
    expect(state.remote).toBe("origin");
    expect(state.artifacts).toEqual({});
    expect(state.signals.signalCount).toBe(0);
  });

  it("persists and loads state", async () => {
    const state = await loadSyncState(testDir, "origin");
    state.artifacts["test-artifact"] = {
      localVersionAtSync: 3,
      remoteVersionAtSync: 3,
      lastSyncedAt: new Date().toISOString(),
    };
    state.signals.signalCount = 5;
    await saveSyncState(testDir, "origin", state);

    const loaded = await loadSyncState(testDir, "origin");
    expect(loaded.artifacts["test-artifact"]?.localVersionAtSync).toBe(3);
    expect(loaded.signals.signalCount).toBe(5);
  });
});

describe("computeArtifactDiff", () => {
  const emptyState: SyncState = {
    version: 1,
    remote: "origin",
    lastSync: "",
    artifacts: {},
    signals: { lastSyncedTimestamp: "1970-01-01T00:00:00Z", signalCount: 0 },
  };

  it("detects new remote artifacts as imports (pull)", () => {
    const local: LocalArtifactInfo[] = [];
    const remote = [remoteArtifact("new-artifact", 1)];

    const diff = computeArtifactDiff(local, remote, emptyState, "pull");
    expect(diff).toHaveLength(1);
    expect(diff[0].slug).toBe("new-artifact");
    expect(diff[0].action).toBe("import");
  });

  it("detects fast-forward when only remote changed (pull)", () => {
    const local = [artifact("shared", 2)];
    const remote = [remoteArtifact("shared", 4)];
    const state: SyncState = {
      ...emptyState,
      artifacts: {
        shared: {
          localVersionAtSync: 2,
          remoteVersionAtSync: 2,
          lastSyncedAt: ts,
        },
      },
    };

    const diff = computeArtifactDiff(local, remote, state, "pull");
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe("fast-forward");
  });

  it("detects skip when both sides unchanged", () => {
    const local = [artifact("shared", 2)];
    const remote = [remoteArtifact("shared", 2)];
    const state: SyncState = {
      ...emptyState,
      artifacts: {
        shared: {
          localVersionAtSync: 2,
          remoteVersionAtSync: 2,
          lastSyncedAt: ts,
        },
      },
    };

    const diff = computeArtifactDiff(local, remote, state, "pull");
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe("skip");
  });

  it("detects merge/conflict when both changed (pull)", () => {
    const local = [artifact("shared", 3)];
    const remote = [remoteArtifact("shared", 4)];
    const state: SyncState = {
      ...emptyState,
      artifacts: {
        shared: {
          localVersionAtSync: 2,
          remoteVersionAtSync: 2,
          lastSyncedAt: ts,
        },
      },
    };

    const diff = computeArtifactDiff(local, remote, state, "pull");
    expect(diff).toHaveLength(1);
    expect(["merge", "conflict"]).toContain(diff[0].action);
  });

  it("detects push candidates (push direction)", () => {
    const local = [artifact("shared", 3)];
    const remote = [remoteArtifact("shared", 2)];
    const state: SyncState = {
      ...emptyState,
      artifacts: {
        shared: {
          localVersionAtSync: 2,
          remoteVersionAtSync: 2,
          lastSyncedAt: ts,
        },
      },
    };

    const diff = computeArtifactDiff(local, remote, state, "push");
    expect(diff).toHaveLength(1);
    expect(diff[0].action).toBe("push");
  });

  it("handles first sync with no prior state", () => {
    const local = [artifact("local-only", 1)];
    const remote = [
      remoteArtifact("remote-only", 1),
      remoteArtifact("local-only", 1),
    ];

    const diff = computeArtifactDiff(local, remote, emptyState, "pull");
    const remoteOnly = diff.find((d) => d.slug === "remote-only");
    expect(remoteOnly).toBeDefined();
    expect(remoteOnly!.action).toBe("import");
  });
});
