/**
 * MCP tool handler tests — call each registered handler directly via a fake
 * McpServer that captures the callbacks. Exercises the real tool code paths
 * against a temp workspace, without spawning the stdio process.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import { registerIdentityTools } from "./identity.js";
import { registerMemoryTools } from "./memory.js";
import { registerArtifactTools } from "./artifact.js";
import { registerStatusTools } from "./status.js";
import { registerReputationTools } from "./reputation.js";
import { registerContractTools } from "./contract.js";
import { registerProjectTools } from "./project.js";
import { registerTaskTools } from "./task.js";
import { registerConfigTools } from "./config.js";
import { registerSwarmTools } from "./swarm.js";
import { registerSyncTools } from "./sync.js";
import { registerExperimentTools } from "./experiment.js";

// ---------------------------------------------------------------------------
// Fake McpServer that captures handlers
// ---------------------------------------------------------------------------

type Handler = (args: Record<string, unknown>) => Promise<unknown>;

function createFakeServer(): { handlers: Map<string, Handler>; server: { registerTool: (name: string, meta: unknown, handler: Handler) => void } } {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    server: {
      registerTool: (name: string, _meta: unknown, handler: Handler) => {
        handlers.set(name, handler);
      },
    },
  };
}

async function call(handlers: Map<string, Handler>, name: string, args: Record<string, unknown> = {}): Promise<{ text: string; isError: boolean }> {
  const handler = handlers.get(name);
  if (!handler) throw new Error(`No handler registered: ${name}`);
  const result = (await handler(args)) as { content?: Array<{ type: string; text: string }>; isError?: boolean };
  const text = result.content?.[0]?.text ?? "";
  return { text, isError: result.isError === true };
}

// ---------------------------------------------------------------------------
// Workspace fixture
// ---------------------------------------------------------------------------

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-mcp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "t",
      id: "urn:awp:workspace:t",
      agent: { did: "did:awp:test-agent", identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("\n# Identity\n", {
      awp: "1.0.0",
      type: "identity",
      name: "Test Agent",
      creature: "test-bot",
      did: "did:awp:test-agent",
    }),
  );
  await writeFile(
    join(dir, "SOUL.md"),
    matter.stringify("\n# Soul\n", { awp: "1.0.0", type: "soul", values: ["accuracy"] }),
  );
  await writeFile(
    join(dir, "USER.md"),
    matter.stringify("\n# User\n", { awp: "1.0.0", type: "user", name: "Test User" }),
  );
  return dir;
}

let WS: string;
beforeEach(async () => {
  WS = await makeWorkspace();
  vi.stubEnv("AWP_WORKSPACE", WS);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(WS, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Identity tools
// ---------------------------------------------------------------------------

describe("identity tools", () => {
  it("awp_read_identity / awp_read_soul / awp_read_user return content", async () => {
    const { handlers, server } = createFakeServer();
    registerIdentityTools(server as never);

    const id = await call(handlers, "awp_read_identity");
    expect(id.isError).toBe(false);
    expect(id.text).toContain("Test Agent");

    const soul = await call(handlers, "awp_read_soul");
    expect(soul.isError).toBe(false);
    expect(soul.text).toContain("accuracy");

    const user = await call(handlers, "awp_read_user");
    expect(user.isError).toBe(false);
    expect(user.text).toContain("Test User");
  });

  it("returns isError when files are missing", async () => {
    await rm(join(WS, "IDENTITY.md"));
    const { handlers, server } = createFakeServer();
    registerIdentityTools(server as never);
    const id = await call(handlers, "awp_read_identity");
    expect(id.isError).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Memory tools
// ---------------------------------------------------------------------------

describe("memory tools", () => {
  it("awp_write_memory creates daily log, awp_read_memory returns it", async () => {
    const { handlers, server } = createFakeServer();
    registerMemoryTools(server as never);

    const write = await call(handlers, "awp_write_memory", { content: "first entry" });
    expect(write.isError).toBe(false);

    const read = await call(handlers, "awp_read_memory", { target: "recent" });
    expect(read.isError).toBe(false);
    expect(read.text).toContain("first entry");
  });

  it("awp_read_memory target=longterm reports missing gracefully", async () => {
    const { handlers, server } = createFakeServer();
    registerMemoryTools(server as never);
    const r = await call(handlers, "awp_read_memory", { target: "longterm" });
    expect(r.isError).toBe(false);
    expect(r.text.toLowerCase()).toContain("no long-term");
  });

  it("awp_read_memory target=longterm returns content when MEMORY.md exists", async () => {
    const { handlers, server } = createFakeServer();
    registerMemoryTools(server as never);
    await writeFile(
      join(WS, "MEMORY.md"),
      matter.stringify("\n# Long-term\n\nPersistent.\n", {
        awp: "1.0.0",
        type: "memory-longterm",
        lastUpdated: new Date().toISOString(),
      }),
    );
    const r = await call(handlers, "awp_read_memory", { target: "longterm" });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Persistent");
  });

  it("awp_read_memory target=recent reports missing dir gracefully", async () => {
    const { handlers, server } = createFakeServer();
    registerMemoryTools(server as never);
    // memory dir not created — should respond, not throw
    const r = await call(handlers, "awp_read_memory", { target: "recent" });
    expect(r.isError).toBe(false);
    expect(r.text.toLowerCase()).toContain("no");
  });

  it("awp_read_memory target=<specific date> returns the right file", async () => {
    const { handlers, server } = createFakeServer();
    registerMemoryTools(server as never);
    await call(handlers, "awp_write_memory", { content: "today's entry" });
    const today = new Date().toISOString().split("T")[0];
    const r = await call(handlers, "awp_read_memory", { target: today });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("today's entry");
  });
});

// ---------------------------------------------------------------------------
// Artifact tools
// ---------------------------------------------------------------------------

describe("artifact tools", () => {
  it("merge (additive) combines body and tags from source into target", async () => {
    const { handlers, server } = createFakeServer();
    registerArtifactTools(server as never);

    await call(handlers, "awp_artifact_write", {
      slug: "target",
      title: "Target",
      content: "Target body.",
      tags: ["base"],
    });
    await call(handlers, "awp_artifact_write", {
      slug: "source",
      title: "Source",
      content: "Source body.",
      tags: ["extra"],
    });
    const result = await call(handlers, "awp_artifact_merge", {
      targetSlug: "target",
      sourceSlug: "source",
      strategy: "additive",
      message: "Merged source",
    });
    expect(result.isError).toBe(false);

    const read = JSON.parse((await call(handlers, "awp_artifact_read", { slug: "target" })).text);
    expect(read.body).toContain("Source body.");
    expect(read.frontmatter.tags).toContain("base");
    expect(read.frontmatter.tags).toContain("extra");
    expect(read.frontmatter.version).toBeGreaterThan(1);
  });

  it("merge rejects unknown strategy", async () => {
    const { handlers, server } = createFakeServer();
    registerArtifactTools(server as never);
    await call(handlers, "awp_artifact_write", { slug: "t", title: "T", content: "T" });
    await call(handlers, "awp_artifact_write", { slug: "s", title: "S", content: "S" });
    const result = await call(handlers, "awp_artifact_merge", {
      targetSlug: "t",
      sourceSlug: "s",
      strategy: "bogus",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Unknown strategy");
  });

  it("merge returns isError when target or source missing", async () => {
    const { handlers, server } = createFakeServer();
    registerArtifactTools(server as never);
    const noTarget = await call(handlers, "awp_artifact_merge", {
      targetSlug: "missing-target",
      sourceSlug: "anything",
    });
    expect(noTarget.isError).toBe(true);

    await call(handlers, "awp_artifact_write", { slug: "exists", title: "X", content: "X" });
    const noSource = await call(handlers, "awp_artifact_merge", {
      targetSlug: "exists",
      sourceSlug: "missing-source",
    });
    expect(noSource.isError).toBe(true);
  });

  it("write + list + read + search round-trip", async () => {
    const { handlers, server } = createFakeServer();
    registerArtifactTools(server as never);

    const write = await call(handlers, "awp_artifact_write", {
      slug: "research-x",
      title: "Research X",
      content: "Body of research.",
      confidence: 0.8,
      tags: ["a"],
    });
    expect(write.isError).toBe(false);
    await access(join(WS, "artifacts", "research-x.md"));

    const list = await call(handlers, "awp_artifact_list");
    expect(list.text).toContain("research-x");

    const read = await call(handlers, "awp_artifact_read", { slug: "research-x" });
    expect(read.text).toContain("Research X");

    const search = await call(handlers, "awp_artifact_search", { query: "Research" });
    expect(search.text).toContain("research-x");
  });
});

// ---------------------------------------------------------------------------
// Status tool
// ---------------------------------------------------------------------------

describe("status tool", () => {
  it("awp_workspace_status returns workspace summary JSON", async () => {
    const { handlers, server } = createFakeServer();
    registerStatusTools(server as never);
    const r = await call(handlers, "awp_workspace_status");
    expect(r.isError).toBe(false);
    expect(r.text.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Reputation tools
// ---------------------------------------------------------------------------

describe("reputation tools", () => {
  it("signal + query", async () => {
    const { handlers, server } = createFakeServer();
    registerReputationTools(server as never);

    const sig = await call(handlers, "awp_reputation_signal", {
      slug: "ext",
      agentDid: "did:awp:ext",
      agentName: "Ext",
      dimension: "reliability",
      score: 0.8,
    });
    expect(sig.isError).toBe(false);

    const q = await call(handlers, "awp_reputation_query", { slug: "ext" });
    expect(q.text).toContain("Ext");
  });
});

// ---------------------------------------------------------------------------
// Contract tools
// ---------------------------------------------------------------------------

describe("contract tools", () => {
  it("create + list + evaluate", async () => {
    const { handlers, server } = createFakeServer();
    registerContractTools(server as never);
    registerReputationTools(server as never);

    // Need a reputation profile for the delegate (for evaluate)
    await call(handlers, "awp_reputation_signal", {
      slug: "ext",
      agentDid: "did:awp:ext",
      agentName: "Ext",
      dimension: "reliability",
      score: 0.7,
    });

    const create = await call(handlers, "awp_contract_create", {
      slug: "research",
      delegate: "did:awp:ext",
      delegateSlug: "ext",
      description: "Do research",
    });
    expect(create.isError).toBe(false);

    const list = await call(handlers, "awp_contract_list");
    expect(list.text).toContain("research");

    const ev = await call(handlers, "awp_contract_evaluate", {
      slug: "research",
      scores: { completeness: 0.9, accuracy: 0.85, clarity: 0.8, timeliness: 1.0 },
    });
    expect(ev.isError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Project + Task tools
// ---------------------------------------------------------------------------

describe("project + task tools", () => {
  it("project create + list + status, task create + update + list + graph", async () => {
    const { handlers, server } = createFakeServer();
    registerProjectTools(server as never);
    registerTaskTools(server as never);

    const proj = await call(handlers, "awp_project_create", { slug: "p1", title: "Project 1" });
    expect(proj.isError).toBe(false);

    const list = await call(handlers, "awp_project_list");
    expect(list.text).toContain("p1");

    const status = await call(handlers, "awp_project_status", { slug: "p1" });
    expect(status.isError).toBe(false);

    const tc = await call(handlers, "awp_task_create", {
      projectSlug: "p1",
      taskSlug: "t1",
      title: "Task 1",
    });
    expect(tc.isError).toBe(false);

    const tu = await call(handlers, "awp_task_update", {
      projectSlug: "p1",
      taskSlug: "t1",
      status: "in-progress",
    });
    expect(tu.isError).toBe(false);

    const tl = await call(handlers, "awp_task_list", { projectSlug: "p1" });
    expect(tl.text).toContain("Task 1");

    const tg = await call(handlers, "awp_task_graph", { projectSlug: "p1" });
    expect(tg.isError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Config tools
// ---------------------------------------------------------------------------

describe("config tools", () => {
  it("returns null content gracefully when optional files are missing", async () => {
    const { handlers, server } = createFakeServer();
    registerConfigTools(server as never);

    const hb = await call(handlers, "awp_read_heartbeat");
    // Heartbeat is optional — handler should report missing without crashing
    expect(typeof hb.text).toBe("string");

    const tools = await call(handlers, "awp_read_tools");
    expect(typeof tools.text).toBe("string");

    const agents = await call(handlers, "awp_read_agents");
    expect(typeof agents.text).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Swarm tools
// ---------------------------------------------------------------------------

describe("swarm tools", () => {
  it("create + show + list", async () => {
    const { handlers, server } = createFakeServer();
    registerSwarmTools(server as never);

    const c = await call(handlers, "awp_swarm_create", {
      slug: "team",
      name: "Team",
      goal: "Goal",
    });
    expect(c.isError).toBe(false);

    const list = await call(handlers, "awp_swarm_list");
    expect(list.text).toContain("team");

    const show = await call(handlers, "awp_swarm_show", { slug: "team" });
    expect(show.isError).toBe(false);
  });

  it("role_add + assign + update lifecycle", async () => {
    const { handlers, server } = createFakeServer();
    registerSwarmTools(server as never);

    await call(handlers, "awp_swarm_create", { slug: "rt", name: "RT", goal: "x" });

    const add = await call(handlers, "awp_swarm_role_add", {
      slug: "rt",
      roleName: "researcher",
      count: 1,
      minReputation: { reliability: 0.5 },
    });
    expect(add.isError).toBe(false);
    expect(add.text).toContain("researcher");

    // Cannot add the same role twice
    const dup = await call(handlers, "awp_swarm_role_add", {
      slug: "rt",
      roleName: "researcher",
      count: 1,
    });
    expect(dup.isError).toBe(true);

    const assign = await call(handlers, "awp_swarm_assign", {
      slug: "rt",
      role: "researcher",
      agentDid: "did:awp:alice",
      agentSlug: "alice",
    });
    expect(assign.isError).toBe(false);
    // Auto-transitions to active when fully staffed
    expect(assign.text).toMatch(/active|recruiting/);

    // Same agent again → already assigned
    const again = await call(handlers, "awp_swarm_assign", {
      slug: "rt",
      role: "researcher",
      agentDid: "did:awp:alice",
      agentSlug: "alice",
    });
    expect(again.isError).toBe(true);

    const upd = await call(handlers, "awp_swarm_update", {
      slug: "rt",
      status: "completed",
    });
    expect(upd.isError).toBe(false);
    expect(upd.text).toContain("completed");
  });

  it("recruit returns candidates without auto, auto-assigns with auto=true", async () => {
    const { handlers, server } = createFakeServer();
    registerSwarmTools(server as never);
    registerReputationTools(server as never);

    // Create a qualified candidate
    await call(handlers, "awp_reputation_signal", {
      slug: "alice",
      agentDid: "did:awp:alice",
      agentName: "Alice",
      dimension: "reliability",
      score: 0.95,
    });

    await call(handlers, "awp_swarm_create", { slug: "rt", name: "RT", goal: "x" });
    await call(handlers, "awp_swarm_role_add", {
      slug: "rt",
      roleName: "researcher",
      count: 1,
      minReputation: { reliability: 0.5 },
    });

    // Without auto — list candidates
    const candidates = await call(handlers, "awp_swarm_recruit", { slug: "rt", auto: false });
    expect(candidates.isError).toBe(false);
    expect(candidates.text).toContain("alice");

    // With auto — actually assign
    const auto = await call(handlers, "awp_swarm_recruit", { slug: "rt", auto: true });
    expect(auto.isError).toBe(false);
    const parsed = JSON.parse(auto.text);
    expect(parsed.recruited).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sync tools
// ---------------------------------------------------------------------------

describe("sync tools", () => {
  it("remote add + list + remove", async () => {
    const target = join(tmpdir(), `awp-mcp-rem-${Date.now()}`);
    await mkdir(target, { recursive: true });

    try {
      const { handlers, server } = createFakeServer();
      registerSyncTools(server as never);

      const add = await call(handlers, "awp_sync_remote_add", {
        name: "origin",
        url: target,
        transport: "local-fs",
      });
      expect(add.isError).toBe(false);

      const list = await call(handlers, "awp_sync_remote_list");
      expect(list.text).toContain("origin");

      const rem = await call(handlers, "awp_sync_remote_remove", { name: "origin" });
      expect(rem.isError).toBe(false);
    } finally {
      await rm(target, { recursive: true, force: true });
    }
  });

  it("pull + diff + status + conflicts work end-to-end", async () => {
    // Build a remote workspace (peer) with an artifact
    const peer = join(tmpdir(), `awp-mcp-peer-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(peer, ".awp"), { recursive: true });
    await mkdir(join(peer, "artifacts"), { recursive: true });
    await writeFile(
      join(peer, ".awp", "workspace.json"),
      JSON.stringify({ awp: "1.0.0", name: "peer", id: "urn:awp:workspace:peer", agent: { did: "did:awp:peer" } }),
    );
    const now = new Date().toISOString();
    await writeFile(
      join(peer, "artifacts", "shared.md"),
      matter.stringify("\nremote body\n", {
        awp: "1.0.0",
        smp: "1.0.0",
        type: "knowledge-artifact",
        id: "artifact:shared",
        title: "Shared",
        authors: ["did:awp:peer"],
        version: 1,
        created: now,
        lastModified: now,
        modifiedBy: "did:awp:peer",
        provenance: [],
      }),
    );

    try {
      const { handlers, server } = createFakeServer();
      registerSyncTools(server as never);

      await call(handlers, "awp_sync_remote_add", {
        name: "peer",
        url: peer,
        transport: "local-fs",
      });

      // diff (pull direction) should surface the remote artifact as an import
      const diff = await call(handlers, "awp_sync_diff", { remote: "peer", direction: "pull" });
      expect(diff.isError).toBe(false);
      expect(diff.text).toContain("shared");

      // dry-run pull
      const dryRun = await call(handlers, "awp_sync_pull", { remote: "peer", dryRun: true });
      expect(dryRun.isError).toBe(false);

      // real pull
      const pull = await call(handlers, "awp_sync_pull", { remote: "peer" });
      expect(pull.isError).toBe(false);
      const pullResult = JSON.parse(pull.text);
      expect(pullResult.imported).toContain("shared");
      await access(join(WS, "artifacts", "shared.md"));

      // push back (no-op since same artifacts, but should not error)
      const push = await call(handlers, "awp_sync_push", { remote: "peer", dryRun: true });
      expect(push.isError).toBe(false);

      // status
      const status = await call(handlers, "awp_sync_status", { remote: "peer" });
      expect(status.isError).toBe(false);
      const parsed = JSON.parse(status.text);
      expect(parsed.remotes[0].name).toBe("peer");
      expect(parsed.remotes[0].trackedArtifacts).toBeGreaterThan(0);

      // conflicts (none expected)
      const conflicts = await call(handlers, "awp_sync_conflicts");
      expect(conflicts.isError).toBe(false);
      expect(JSON.parse(conflicts.text).conflicts).toEqual([]);
    } finally {
      await rm(peer, { recursive: true, force: true });
    }
  });

  it("resolve rejects when no conflict exists for the slug", async () => {
    const { handlers, server } = createFakeServer();
    registerSyncTools(server as never);
    // resolveConflict throws if no conflict file exists. Confirm the handler
    // surfaces the underlying error rather than silently succeeding.
    await expect(
      call(handlers, "awp_sync_resolve", { slug: "no-such", mode: "local" }),
    ).rejects.toThrow(/No conflict/);
  });

  it("pull_signals imports reputation signals", async () => {
    const peer = join(tmpdir(), `awp-mcp-peer-sig-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(peer, ".awp"), { recursive: true });
    await mkdir(join(peer, "reputation"), { recursive: true });
    await writeFile(
      join(peer, ".awp", "workspace.json"),
      JSON.stringify({ awp: "1.0.0", name: "peer", id: "urn:awp:workspace:peer", agent: { did: "did:awp:peer" } }),
    );
    const now = new Date().toISOString();
    await writeFile(
      join(peer, "reputation", "bob.md"),
      matter.stringify("\nBob.\n", {
        awp: "1.0.0",
        rdp: "1.0.0",
        type: "reputation-profile",
        id: "reputation:bob",
        agentDid: "did:awp:bob",
        agentName: "Bob",
        lastUpdated: now,
        dimensions: {},
        signals: [
          { source: "did:awp:peer", dimension: "reliability", score: 0.9, timestamp: now },
        ],
      }),
    );

    try {
      const { handlers, server } = createFakeServer();
      registerSyncTools(server as never);

      await call(handlers, "awp_sync_remote_add", {
        name: "peer",
        url: peer,
        transport: "local-fs",
      });

      const result = await call(handlers, "awp_sync_pull_signals", {
        remote: "peer",
        since: "1900-01-01T00:00:00Z",
      });
      expect(result.isError).toBe(false);
      const parsed = JSON.parse(result.text);
      expect(parsed.imported).toBeGreaterThan(0);
    } finally {
      await rm(peer, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Experiment tools
// ---------------------------------------------------------------------------

describe("experiment tools", () => {
  async function seedExperiment(societyId: string, expId: string, overrides: Record<string, unknown> = {}) {
    const societiesRoot = join(WS, "societies", societyId, "metrics");
    await mkdir(societiesRoot, { recursive: true });
    const cycles = Array.from({ length: 3 }, (_, i) => ({
      cycleNumber: i,
      startedAt: new Date(Date.now() - (3 - i) * 1000).toISOString(),
      endedAt: new Date(Date.now() - (3 - i) * 1000 + 500).toISOString(),
      contractsCreated: [`contract:${i}`],
      tasksExecuted: [],
      reputationChanges: [],
      metrics: {
        tasksAttempted: 10,
        tasksSucceeded: 8,
        tasksFailed: 2,
        successRate: 0.8 + i * 0.05,
        totalTokens: 1000 + i * 100,
        totalDurationMs: 5000,
        avgTaskDurationMs: 500,
        antiPatternsDetected: [],
      },
    }));
    const experiment = {
      experimentId: expId,
      manifestoId: "manifesto:test",
      societyId,
      startedAt: cycles[0].startedAt,
      endedAt: cycles[cycles.length - 1].endedAt,
      totalCycles: cycles.length,
      cycles,
      finalReputations: {},
      aggregateMetrics: {
        totalTasks: 30,
        totalSuccesses: 24,
        totalFailures: 6,
        overallSuccessRate: 0.8,
        totalTokens: 3300,
        totalDurationMs: 15000,
        avgCycleDurationMs: 5000,
      },
      successCriteriaResults: [
        { criterionId: "success-rate", met: true, actualValue: 0.8, threshold: 0.5 },
      ],
      ...overrides,
    };
    await writeFile(join(societiesRoot, `${expId}.json`), JSON.stringify(experiment, null, 2));
  }

  it("list + show + metrics for a seeded experiment", async () => {
    await seedExperiment("soc-a", "exp-1");

    const { handlers, server } = createFakeServer();
    registerExperimentTools(server as never);

    const list = await call(handlers, "awp_experiment_list", { societyId: "soc-a" });
    expect(list.isError).toBe(false);
    const parsed = JSON.parse(list.text);
    expect(parsed.experiments).toHaveLength(1);
    expect(parsed.experiments[0].experimentId).toBe("exp-1");

    const show = await call(handlers, "awp_experiment_show", {
      societyId: "soc-a",
      experimentId: "exp-1",
      cycleDetail: true,
    });
    expect(show.isError).toBe(false);
    expect(show.text).toContain("exp-1");

    const metrics = await call(handlers, "awp_experiment_metrics", {
      societyId: "soc-a",
      experimentId: "exp-1",
      metric: "success-rate",
    });
    expect(metrics.isError).toBe(false);
    const out = JSON.parse(metrics.text);
    expect(out.perCycle).toHaveLength(3);
    expect(out.stats.mean).toBeGreaterThan(0.7);
  });

  it("show returns error for missing experiment", async () => {
    const { handlers, server } = createFakeServer();
    registerExperimentTools(server as never);
    const show = await call(handlers, "awp_experiment_show", {
      societyId: "nope",
      experimentId: "nope",
    });
    expect(show.isError).toBe(true);
  });

  it("compare returns statistical comparison for two experiments", async () => {
    await seedExperiment("soc-a", "exp-1");
    await seedExperiment("soc-b", "exp-2", { manifestoId: "manifesto:other" });

    const { handlers, server } = createFakeServer();
    registerExperimentTools(server as never);

    const cmp = await call(handlers, "awp_experiment_compare", {
      societyA: "soc-a",
      experimentA: "exp-1",
      societyB: "soc-b",
      experimentB: "exp-2",
      test: "t-test",
    });
    expect(cmp.isError).toBe(false);
    const parsed = JSON.parse(cmp.text);
    expect(parsed.experimentA).toBe("exp-1");
    expect(parsed.experimentB).toBe("exp-2");
    expect(parsed.metrics).toBeDefined();
  });
});
