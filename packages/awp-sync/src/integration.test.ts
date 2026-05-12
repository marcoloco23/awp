/**
 * Sync integration tests — exercise the full SyncEngine + LocalFsTransport
 * stack against two real on-disk workspaces in tmpdir.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, readFile, rm, access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import matter from "gray-matter";

import { addRemote, listRemotes } from "./remote-registry.js";
import { SyncEngine } from "./sync-engine.js";
import { LocalFsTransport } from "./transport/local-fs.js";
import { GitRemoteTransport } from "./transport/git-remote.js";
import { scanLocalArtifacts, pullArtifacts } from "./operations/artifact-sync.js";
import { exportSignals, importSignals } from "./operations/signal-sync.js";

const execFile = promisify(execFileCb);

async function makeWorkspace(name: string, agentDid: string): Promise<string> {
  const dir = join(tmpdir(), `awp-sync-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await mkdir(join(dir, "artifacts"), { recursive: true });
  await mkdir(join(dir, "reputation"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name,
      id: `urn:awp:workspace:${name}`,
      agent: { did: agentDid, identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("\n# Identity\n", { awp: "1.0.0", type: "identity", name, did: agentDid }),
  );
  return dir;
}

async function writeArtifact(workspace: string, slug: string, content: string, fm: Record<string, unknown>): Promise<void> {
  await writeFile(join(workspace, "artifacts", `${slug}.md`), matter.stringify(content, fm));
}

function artifactFm(slug: string, version = 1, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    awp: "1.0.0",
    smp: "1.0.0",
    type: "knowledge-artifact",
    id: `artifact:${slug}`,
    title: slug,
    authors: ["did:awp:author"],
    version,
    created: now,
    lastModified: now,
    modifiedBy: "did:awp:author",
    provenance: [],
    ...extra,
  };
}

let wsA: string;
let wsB: string;

beforeEach(async () => {
  wsA = await makeWorkspace("a", "did:awp:a");
  wsB = await makeWorkspace("b", "did:awp:b");
});
afterEach(async () => {
  await rm(wsA, { recursive: true, force: true });
  await rm(wsB, { recursive: true, force: true });
});

describe("LocalFsTransport", () => {
  it("connect() returns workspace info from manifest", async () => {
    const transport = new LocalFsTransport();
    const info = await transport.connect({
      url: wsB,
      transport: "local-fs",
      added: new Date().toISOString(),
      lastSync: null,
    });
    expect(info.workspaceName).toBe("b");
    expect(info.agentDid).toBe("did:awp:b");
    await transport.disconnect();
  });

  it("listArtifacts() returns manifests with the right shape", async () => {
    await writeArtifact(wsB, "x", "body", artifactFm("x", 3));
    const transport = new LocalFsTransport();
    await transport.connect({ url: wsB, transport: "local-fs", added: "", lastSync: null });
    const manifests = await transport.listArtifacts();
    expect(manifests).toHaveLength(1);
    expect(manifests[0].slug).toBe("x");
    expect(manifests[0].version).toBe(3);
    await transport.disconnect();
  });

  it("readArtifact returns frontmatter + body", async () => {
    await writeArtifact(wsB, "x", "Body text.", artifactFm("x"));
    const transport = new LocalFsTransport();
    await transport.connect({ url: wsB, transport: "local-fs", added: "", lastSync: null });
    const r = await transport.readArtifact("x");
    expect(r.frontmatter.id).toBe("artifact:x");
    expect(r.content.trim()).toBe("Body text.");
    await transport.disconnect();
  });

  it("writeArtifact persists a file", async () => {
    const transport = new LocalFsTransport();
    await transport.connect({ url: wsB, transport: "local-fs", added: "", lastSync: null });
    await transport.writeArtifact("new-art", matter.stringify("New", artifactFm("new-art")));
    await access(join(wsB, "artifacts", "new-art.md"));
    await transport.disconnect();
  });

  it("listArtifacts honors slugPattern filter", async () => {
    await writeArtifact(wsB, "llm-1", "x", artifactFm("llm-1"));
    await writeArtifact(wsB, "other", "x", artifactFm("other"));
    const transport = new LocalFsTransport();
    await transport.connect({ url: wsB, transport: "local-fs", added: "", lastSync: null });
    const llm = await transport.listArtifacts({ slugPattern: "llm-*" });
    expect(llm.map((m) => m.slug)).toEqual(["llm-1"]);
    await transport.disconnect();
  });
});

describe("operations.scanLocalArtifacts", () => {
  it("returns manifests for every artifact in workspace", async () => {
    await writeArtifact(wsA, "x", "x", artifactFm("x", 2));
    await writeArtifact(wsA, "y", "y", artifactFm("y", 1));
    const list = await scanLocalArtifacts(wsA);
    expect(list.map((m) => m.slug).sort()).toEqual(["x", "y"]);
    const x = list.find((m) => m.slug === "x");
    expect(x?.version).toBe(2);
  });

  it("returns [] when no artifacts dir", async () => {
    const empty = await makeWorkspace("empty", "did:awp:e");
    await rm(join(empty, "artifacts"), { recursive: true });
    try {
      expect(await scanLocalArtifacts(empty)).toEqual([]);
    } finally {
      await rm(empty, { recursive: true, force: true });
    }
  });
});

describe("SyncEngine pull/push (local-fs)", () => {
  it("pull imports a remote artifact that doesn't exist locally", async () => {
    // wsB has an artifact "shared"
    await writeArtifact(wsB, "shared", "remote body", artifactFm("shared", 1));

    // wsA registers wsB as a remote and pulls
    await addRemote(wsA, "peer", { url: wsB, transport: "local-fs" });
    const engine = new SyncEngine(wsA);
    const result = await engine.pull("peer");

    expect(result.imported).toContain("shared");
    await access(join(wsA, "artifacts", "shared.md"));
    const raw = await readFile(join(wsA, "artifacts", "shared.md"), "utf-8");
    expect(raw).toContain("remote body");
  });

  it("dry-run pull does not write files", async () => {
    await writeArtifact(wsB, "preview-only", "x", artifactFm("preview-only"));
    await addRemote(wsA, "peer", { url: wsB, transport: "local-fs" });
    const engine = new SyncEngine(wsA);
    const result = await engine.pull("peer", { dryRun: true });
    expect(result.imported).toContain("preview-only");
    // The file should NOT exist locally
    await expect(access(join(wsA, "artifacts", "preview-only.md"))).rejects.toThrow();
  });

  it("push exports a local artifact to a remote", async () => {
    await writeArtifact(wsA, "outgoing", "local body", artifactFm("outgoing"));
    await addRemote(wsA, "peer", { url: wsB, transport: "local-fs" });
    const engine = new SyncEngine(wsA);
    const result = await engine.push("peer");
    expect(result.imported.concat(result.updated)).toContain("outgoing");
    await access(join(wsB, "artifacts", "outgoing.md"));
  });

  it("diff reports differences without modifying state", async () => {
    await writeArtifact(wsB, "remote-only", "x", artifactFm("remote-only"));
    await writeArtifact(wsA, "local-only", "x", artifactFm("local-only"));

    await addRemote(wsA, "peer", { url: wsB, transport: "local-fs" });
    const engine = new SyncEngine(wsA);
    const pullDiff = await engine.diff("peer", "pull");
    expect(pullDiff.some((e) => e.slug === "remote-only")).toBe(true);

    const pushDiff = await engine.diff("peer", "push");
    expect(pushDiff.some((e) => e.slug === "local-only")).toBe(true);
  });
});

describe("pullArtifacts helper (direct)", () => {
  it("pulls full content via the transport into local workspace", async () => {
    await writeArtifact(wsB, "alpha", "alpha body", artifactFm("alpha"));

    const transport = new LocalFsTransport();
    await transport.connect({ url: wsB, transport: "local-fs", added: "", lastSync: null });

    const diff = [
      {
        slug: "alpha" as const,
        action: "import" as const,
        localVersion: null,
        remoteVersion: 1,
        reason: "new",
      },
    ];
    await addRemote(wsA, "peer", { url: wsB, transport: "local-fs" });
    const { imported } = await pullArtifacts(wsA, "peer", transport, diff);
    expect(imported).toContain("alpha");

    await transport.disconnect();
  });
});

describe("signal sync", () => {
  async function writeRepProfile(workspace: string, slug: string, signals: Array<Record<string, unknown>>): Promise<void> {
    const now = new Date().toISOString();
    await writeFile(
      join(workspace, "reputation", `${slug}.md`),
      matter.stringify("\n# Profile\n", {
        awp: "1.0.0",
        rdp: "1.0.0",
        type: "reputation-profile",
        id: `reputation:${slug}`,
        agentDid: `did:awp:${slug}`,
        agentName: slug,
        lastUpdated: now,
        dimensions: {},
        signals,
      }),
    );
  }

  it("exportSignals returns signals newer than the watermark", async () => {
    const now = new Date().toISOString();
    await writeRepProfile(wsA, "subj", [
      { source: "did:awp:a", dimension: "reliability", score: 0.9, timestamp: now },
    ]);
    const batch = await exportSignals(wsA, "1900-01-01T00:00:00Z");
    expect(batch.signals.length).toBeGreaterThan(0);
  });

  it("importSignals merges signals into local profiles", async () => {
    const now = new Date().toISOString();

    // wsB has the source signals (about subj)
    await writeRepProfile(wsB, "subj", [
      { source: "did:awp:b", dimension: "reliability", score: 0.85, timestamp: now, evidence: "contract:x", message: "good" },
    ]);

    const batch = await exportSignals(wsB, "1900-01-01T00:00:00Z");
    expect(batch.signals.length).toBeGreaterThan(0);

    // Now import into wsA
    const imported = await importSignals(wsA, batch);
    expect(imported).toBeGreaterThan(0);

    // Check that the profile now exists in wsA
    const files = await readdir(join(wsA, "reputation"));
    expect(files.some((f) => f.endsWith(".md"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// git-remote transport — only runs if `git` is available
// ---------------------------------------------------------------------------

async function hasGit(): Promise<boolean> {
  try {
    await execFile("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

describe.runIf(await hasGit())("GitRemoteTransport (requires git)", () => {
  it("connects to a local bare repo + reads/writes an artifact", async () => {
    const bareDir = join(tmpdir(), `awp-bare-${Date.now()}`);
    const workdir = join(tmpdir(), `awp-gitwork-${Date.now()}`);

    try {
      await mkdir(bareDir, { recursive: true });
      await execFile("git", ["init", "--bare", bareDir]);

      // Create a working workspace, init git, add a manifest + artifact, push to bare
      await mkdir(workdir, { recursive: true });
      await execFile("git", ["init", workdir]);
      await execFile("git", ["-C", workdir, "config", "user.email", "test@test"]);
      await execFile("git", ["-C", workdir, "config", "user.name", "Test"]);
      await mkdir(join(workdir, ".awp"), { recursive: true });
      await mkdir(join(workdir, "artifacts"), { recursive: true });
      await writeFile(
        join(workdir, ".awp", "workspace.json"),
        JSON.stringify({ awp: "1.0.0", name: "git-ws", id: "urn:awp:workspace:gw", agent: { did: "did:awp:gw" } }),
      );
      await writeArtifact(workdir, "gitart", "body", artifactFm("gitart"));
      await execFile("git", ["-C", workdir, "add", "."]);
      await execFile("git", ["-C", workdir, "commit", "-m", "init"]);
      await execFile("git", ["-C", workdir, "branch", "-M", "main"]);
      await execFile("git", ["-C", workdir, "remote", "add", "origin", bareDir]);
      await execFile("git", ["-C", workdir, "push", "origin", "main"]);

      // Now use the GitRemoteTransport to read the artifact
      const transport = new GitRemoteTransport();
      const info = await transport.connect({
        url: bareDir,
        transport: "git-remote",
        added: new Date().toISOString(),
        lastSync: null,
        branch: "main",
      });
      expect(info.workspaceName).toBe("git-ws");

      const list = await transport.listArtifacts();
      expect(list.map((m) => m.slug)).toContain("gitart");

      const r = await transport.readArtifact("gitart");
      expect(r.frontmatter.id).toBe("artifact:gitart");

      await transport.disconnect();
    } finally {
      await rm(bareDir, { recursive: true, force: true });
      await rm(workdir, { recursive: true, force: true });
    }
  }, 30_000);
});

describe("remote registry", () => {
  it("addRemote + listRemotes round-trip", async () => {
    await addRemote(wsA, "peer", { url: wsB, transport: "local-fs" });
    const remotes = await listRemotes(wsA);
    expect(Object.keys(remotes)).toContain("peer");
    expect(remotes.peer.url).toBe(wsB);
  });
});
