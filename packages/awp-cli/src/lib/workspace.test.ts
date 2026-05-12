import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { generateWorkspaceId, createDefaultManifest, inspectWorkspace } from "./workspace.js";
import { AWP_VERSION } from "@agent-workspace/core";

describe("workspace utilities", () => {
  describe("generateWorkspaceId", () => {
    it("generates a valid URN format", () => {
      const id = generateWorkspaceId();
      expect(id).toMatch(/^urn:awp:workspace:[a-f0-9]{16}$/);
    });

    it("generates unique IDs", () => {
      const id1 = generateWorkspaceId();
      const id2 = generateWorkspaceId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("createDefaultManifest", () => {
    it("creates a manifest with required fields", () => {
      const manifest = createDefaultManifest("test-workspace");

      expect(manifest.awp).toBe(AWP_VERSION);
      expect(manifest.name).toBe("test-workspace");
      expect(manifest.id).toMatch(/^urn:awp:workspace:/);
      expect(manifest.created).toBeDefined();
      expect(manifest.agent.identityFile).toBe("IDENTITY.md");
      expect(manifest.capabilities).toEqual([]);
      expect(manifest.protocols).toEqual({ a2a: true, mcp: true });
    });

    it("sets created timestamp to current time", () => {
      const before = new Date().toISOString();
      const manifest = createDefaultManifest("test");
      const after = new Date().toISOString();

      expect(manifest.created >= before).toBe(true);
      expect(manifest.created <= after).toBe(true);
    });
  });
});

describe("inspectWorkspace", () => {
  let root: string;

  async function setup(extras: Record<string, string> = {}): Promise<void> {
    await mkdir(join(root, ".awp"), { recursive: true });
    await writeFile(
      join(root, ".awp", "workspace.json"),
      JSON.stringify({
        awp: AWP_VERSION,
        id: generateWorkspaceId(),
        name: "test",
        created: new Date().toISOString(),
        agent: { did: "did:awp:test", identityFile: "IDENTITY.md" },
      }),
    );
    for (const [filename, body] of Object.entries(extras)) {
      await writeFile(join(root, filename), body);
    }
  }

  beforeEach(async () => {
    root = join(tmpdir(), `awp-cli-insp-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(root, { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reports required files as present + valid when frontmatter is correct", async () => {
    await setup({
      "IDENTITY.md": matter.stringify("\n# Id\n", { awp: AWP_VERSION, type: "identity" }),
      "SOUL.md": matter.stringify("\n# Soul\n", { awp: AWP_VERSION, type: "soul" }),
    });
    const info = await inspectWorkspace(root);
    expect(info.root).toBe(root);
    expect(info.manifest.name).toBe("test");
    const identity = info.files.required.find((f) => f.file === "IDENTITY.md");
    expect(identity?.exists).toBe(true);
    expect(identity?.valid).toBe(true);
  });

  it("reports missing required files as absent + invalid", async () => {
    await setup();
    const info = await inspectWorkspace(root);
    const identity = info.files.required.find((f) => f.file === "IDENTITY.md");
    expect(identity?.exists).toBe(false);
    expect(identity?.valid).toBe(false);
  });

  it("reports invalid frontmatter as exists=true but valid=false", async () => {
    await setup({ "IDENTITY.md": "no frontmatter here\n" });
    const info = await inspectWorkspace(root);
    const identity = info.files.required.find((f) => f.file === "IDENTITY.md");
    expect(identity?.exists).toBe(true);
    expect(identity?.valid).toBe(false);
  });
});
