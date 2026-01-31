import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { SyncEngine } from "./sync-engine.js";
import { addRemote } from "./remote-registry.js";

let workspaceA: string;
let workspaceB: string;

/** Create a minimal AWP workspace structure */
async function createWorkspace(dir: string, name: string): Promise<void> {
  await mkdir(join(dir, ".awp", "sync", "state"), { recursive: true });
  await mkdir(join(dir, "artifacts"), { recursive: true });
  await mkdir(join(dir, "reputation"), { recursive: true });

  // workspace.json
  const manifest = {
    awp: "0.9.0",
    name,
    agent: {
      name: `${name}-agent`,
      did: `did:awp:${name}`,
    },
  };
  await writeFile(join(dir, ".awp", "workspace.json"), JSON.stringify(manifest, null, 2), "utf-8");
}

/** Create an artifact in a workspace */
async function createArtifact(
  workspace: string,
  slug: string,
  version: number,
  body: string
): Promise<void> {
  const frontmatter = {
    awp: "0.9.0",
    smp: "1.0",
    type: "knowledge-artifact",
    id: `artifact:${slug}`,
    title: slug.replace(/-/g, " "),
    authors: ["did:awp:test"],
    version,
    confidence: 0.8,
    tags: ["test"],
    created: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    provenance: [
      {
        agent: "did:awp:test",
        action: "created",
        timestamp: new Date().toISOString(),
        message: "Initial creation",
      },
    ],
  };

  const content = matter.stringify(`\n${body}\n`, frontmatter);
  await writeFile(join(workspace, "artifacts", `${slug}.md`), content, "utf-8");
}

beforeEach(async () => {
  workspaceA = await mkdtemp(join(tmpdir(), "awp-sync-engine-a-"));
  workspaceB = await mkdtemp(join(tmpdir(), "awp-sync-engine-b-"));

  await createWorkspace(workspaceA, "workspace-a");
  await createWorkspace(workspaceB, "workspace-b");
});

afterEach(async () => {
  await rm(workspaceA, { recursive: true, force: true });
  await rm(workspaceB, { recursive: true, force: true });
});

describe("SyncEngine", () => {
  describe("pull", () => {
    it("imports new artifacts from remote", async () => {
      // Create artifact only in workspace B
      await createArtifact(workspaceB, "remote-knowledge", 1, "Knowledge from workspace B");

      // Add B as a remote of A
      await addRemote(workspaceA, "origin", {
        url: workspaceB,
        transport: "local-fs",
      });

      const engine = new SyncEngine(workspaceA);
      const result = await engine.pull("origin");

      expect(result.imported).toContain("remote-knowledge");
      expect(result.direction).toBe("pull");

      // Verify artifact exists in workspace A
      const pulledContent = await readFile(
        join(workspaceA, "artifacts", "remote-knowledge.md"),
        "utf-8"
      );
      expect(pulledContent).toContain("Knowledge from workspace B");

      // Verify synced provenance
      const { data } = matter(pulledContent);
      const provenance = data.provenance as Array<{ action: string; syncSource?: string }>;
      const syncEntry = provenance.find((p) => p.action === "synced");
      expect(syncEntry).toBeDefined();
      expect(syncEntry!.syncSource).toBeDefined();
    });

    it("returns dry-run results without modifying files", async () => {
      await createArtifact(workspaceB, "dry-run-test", 1, "Should not be imported");

      await addRemote(workspaceA, "origin", {
        url: workspaceB,
        transport: "local-fs",
      });

      const engine = new SyncEngine(workspaceA);
      const result = await engine.pull("origin", { dryRun: true });

      expect(result.imported).toContain("dry-run-test");

      // Verify file was NOT created
      await expect(
        readFile(join(workspaceA, "artifacts", "dry-run-test.md"), "utf-8")
      ).rejects.toThrow();
    });
  });

  describe("push", () => {
    it("pushes local artifacts to remote", async () => {
      await createArtifact(workspaceA, "local-knowledge", 1, "Knowledge from workspace A");

      await addRemote(workspaceA, "origin", {
        url: workspaceB,
        transport: "local-fs",
      });

      const engine = new SyncEngine(workspaceA);
      const result = await engine.push("origin");

      expect(result.updated).toContain("local-knowledge");

      // Verify artifact exists in workspace B
      const pushedContent = await readFile(
        join(workspaceB, "artifacts", "local-knowledge.md"),
        "utf-8"
      );
      expect(pushedContent).toContain("Knowledge from workspace A");
    });
  });

  describe("diff", () => {
    it("shows differences between workspaces", async () => {
      await createArtifact(workspaceB, "remote-only", 1, "Only in B");

      await addRemote(workspaceA, "origin", {
        url: workspaceB,
        transport: "local-fs",
      });

      const engine = new SyncEngine(workspaceA);
      const entries = await engine.diff("origin", "pull");

      expect(entries.length).toBeGreaterThan(0);
      const remoteEntry = entries.find((e) => e.slug === "remote-only");
      expect(remoteEntry).toBeDefined();
      expect(remoteEntry!.action).toBe("import");
    });
  });

  describe("error handling", () => {
    it("throws for unknown remote", async () => {
      const engine = new SyncEngine(workspaceA);
      await expect(engine.pull("nonexistent")).rejects.toThrow(/not found/);
    });
  });
});
