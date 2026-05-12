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
});

// ---------------------------------------------------------------------------
// Artifact tools
// ---------------------------------------------------------------------------

describe("artifact tools", () => {
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
});
