import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdir, rm, realpath, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { runCli, CLI_PATH } from "./helpers/cli.js";

let WS: string;
let scratchRoot: string;

beforeAll(async () => {
  if (!existsSync(CLI_PATH)) {
    throw new Error(
      `CLI not built at ${CLI_PATH}. Run \`npm run build --workspace=@agent-workspace/cli\` first.`,
    );
  }
});

beforeEach(async () => {
  const base = await realpath(tmpdir());
  scratchRoot = join(base, `awp-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(scratchRoot, { recursive: true });
  WS = scratchRoot;
});

afterEach(async () => {
  if (scratchRoot) {
    await rm(scratchRoot, { recursive: true, force: true });
  }
});

describe("CLI E2E — workspace bootstrap", () => {
  it("init creates a valid workspace", async () => {
    const r = await runCli(["init", "."], WS);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("AWP workspace initialized");
    await access(join(WS, ".awp", "workspace.json"));
    await access(join(WS, "IDENTITY.md"));
    await access(join(WS, "SOUL.md"));
    await access(join(WS, "USER.md"));
  });

  it("init --with-examples creates example files", async () => {
    const r = await runCli(["init", ".", "--with-examples"], WS);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Example files created");
    await access(join(WS, "artifacts", "example-research.md"));
    await access(join(WS, "projects", "example-project.md"));
  });

  it("validate passes on a fresh workspace", async () => {
    await runCli(["init", "."], WS);
    const r = await runCli(["validate"], WS);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("Validation PASSED");
  });

  it("inspect prints workspace summary", async () => {
    await runCli(["init", "."], WS);
    const r = await runCli(["inspect"], WS);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("AWP Workspace");
    expect(r.stdout).toContain("Root:");
  });
});

describe("CLI E2E — identity", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("identity generate creates a did:key", async () => {
    const r = await runCli(["identity", "generate"], WS);
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/DID: did:key:/);
    await access(join(WS, ".awp", "private-key.pem"));
  });

  it("identity export outputs an A2A agent card", async () => {
    await runCli(["identity", "generate"], WS);
    const r = await runCli(["identity", "export"], WS);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("\"name\"");
  });
});

describe("CLI E2E — memory", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("memory log writes today's entry, memory search finds it", async () => {
    const log = await runCli(["memory", "log", "first entry"], WS);
    expect(log.code).toBe(0);
    expect(log.stdout).toContain("Logged to memory/");
    const search = await runCli(["memory", "search", "first"], WS);
    expect(search.code).toBe(0);
    expect(search.stdout).toContain("first entry");
  });

  it("memory log accepts tags", async () => {
    const log = await runCli(["memory", "log", "tagged entry", "--tags", "research,important"], WS);
    expect(log.code).toBe(0);
    const date = new Date().toISOString().split("T")[0];
    const content = await readFile(join(WS, "memory", `${date}.md`), "utf-8");
    expect(content).toContain("research");
    expect(content).toContain("important");
  });
});

describe("CLI E2E — artifact", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("create + list + search round-trip", async () => {
    const c = await runCli(["artifact", "create", "my-research", "--title", "My Research"], WS);
    expect(c.code).toBe(0);
    expect(c.stdout).toContain("Created artifacts/my-research.md");

    const l = await runCli(["artifact", "list"], WS);
    expect(l.code).toBe(0);
    expect(l.stdout).toContain("my-research");

    const s = await runCli(["artifact", "search", "research"], WS);
    expect(s.code).toBe(0);
  });

  it("artifact create with tags and confidence persists them", async () => {
    const c = await runCli(
      ["artifact", "create", "tagged-art", "--tags", "a,b", "--confidence", "0.8"],
      WS,
    );
    expect(c.code).toBe(0);
    const raw = await readFile(join(WS, "artifacts", "tagged-art.md"), "utf-8");
    expect(raw).toContain("confidence: 0.8");
    expect(raw).toContain("- a");
  });
});

describe("CLI E2E — reputation", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("signal + query + list", async () => {
    const sig = await runCli(
      [
        "reputation", "signal", "external",
        "--dimension", "reliability",
        "--score", "0.8",
        "--agent-did", "did:awp:external",
        "--agent-name", "External Agent",
      ],
      WS,
    );
    expect(sig.code).toBe(0);
    expect(sig.stdout).toContain("Created reputation/external.md");

    const q = await runCli(["reputation", "query", "external"], WS);
    expect(q.code).toBe(0);
    expect(q.stdout).toContain("External Agent");

    const l = await runCli(["reputation", "list"], WS);
    expect(l.code).toBe(0);
    expect(l.stdout).toContain("external");
  });
});

describe("CLI E2E — contract", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("create + list + show", async () => {
    const c = await runCli(
      [
        "contract", "create", "research",
        "--delegate", "did:awp:external",
        "--delegate-slug", "external",
        "--description", "Research thing",
      ],
      WS,
    );
    expect(c.code).toBe(0);
    expect(c.stdout).toContain("Created contracts/research.md");

    const l = await runCli(["contract", "list"], WS);
    expect(l.code).toBe(0);
    expect(l.stdout).toContain("research");

    const s = await runCli(["contract", "show", "research"], WS);
    expect(s.code).toBe(0);
    expect(s.stdout).toContain("research");
  });
});

describe("CLI E2E — project + task", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("project create + show + close", async () => {
    const c = await runCli(["project", "create", "p1", "--title", "P1"], WS);
    expect(c.code).toBe(0);
    expect(c.stdout).toContain("Created projects/p1.md");

    const l = await runCli(["project", "list"], WS);
    expect(l.stdout).toContain("p1");

    const s = await runCli(["project", "show", "p1"], WS);
    expect(s.code).toBe(0);

    const close = await runCli(["project", "close", "p1"], WS);
    expect(close.code).toBe(0);
  });

  it("task create + list + update + show + graph", async () => {
    await runCli(["project", "create", "p1", "--title", "P1"], WS);
    const c = await runCli(["task", "create", "p1", "t1", "--title", "Task 1"], WS);
    expect(c.code).toBe(0);

    const list = await runCli(["task", "list", "p1"], WS);
    expect(list.stdout).toContain("t1");

    const upd = await runCli(["task", "update", "p1", "t1", "--status", "in-progress"], WS);
    expect(upd.code).toBe(0);

    const show = await runCli(["task", "show", "p1", "t1"], WS);
    expect(show.code).toBe(0);
    expect(show.stdout).toContain("in-progress");

    const graph = await runCli(["task", "graph", "p1"], WS);
    expect(graph.code).toBe(0);
  });
});

describe("CLI E2E — swarm", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("swarm create + show + list", async () => {
    const c = await runCli(["swarm", "create", "team", "--name", "Team", "--goal", "Goal"], WS);
    expect(c.code).toBe(0);
    expect(c.stdout).toContain("Created swarms/team.md");

    const l = await runCli(["swarm", "list"], WS);
    expect(l.stdout).toContain("team");

    const s = await runCli(["swarm", "show", "team"], WS);
    expect(s.code).toBe(0);
  });
});

describe("CLI E2E — schema", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("schema list / show / values / example", async () => {
    const l = await runCli(["schema", "list"], WS);
    expect(l.code).toBe(0);
    expect(l.stdout).toContain("identity");

    const s = await runCli(["schema", "show", "identity"], WS);
    expect(s.code).toBe(0);

    const v = await runCli(["schema", "values", "task-status"], WS);
    // values may exit 0 or 1 depending on type — just exercise it
    expect([0, 1]).toContain(v.code);

    const ex = await runCli(["schema", "example", "task"], WS);
    expect(ex.code).toBe(0);
  });
});

describe("CLI E2E — status", () => {
  it("status runs on a fresh workspace", async () => {
    await runCli(["init", "."], WS);
    const r = await runCli(["status"], WS);
    expect(r.code).toBe(0);
    expect(r.stdout).toContain("AWP Workspace");
  });
});

describe("CLI E2E — sync remote", () => {
  beforeEach(async () => {
    await runCli(["init", "."], WS);
  });

  it("sync remote add + list + remove (local-fs)", async () => {
    const target = join(scratchRoot, "other-ws");
    await mkdir(target, { recursive: true });

    const add = await runCli(["sync", "remote", "add", "other", target, "--transport", "local-fs"], WS);
    expect(add.code).toBe(0);
    expect(add.stdout).toContain("added");

    const list = await runCli(["sync", "remote", "list"], WS);
    expect(list.code).toBe(0);
    expect(list.stdout).toContain("other");

    const rem = await runCli(["sync", "remote", "remove", "other"], WS);
    expect(rem.code).toBe(0);
    expect(rem.stdout).toContain("removed");
  });
});
