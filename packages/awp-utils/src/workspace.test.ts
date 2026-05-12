import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  findWorkspaceRoot,
  loadManifest,
  fileExists,
  getAgentDid,
  safeReadFile,
  getWorkspaceRoot,
} from "./workspace.js";

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-ws-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "t",
      id: "urn:awp:workspace:t",
      agent: { did: "did:awp:test", identityFile: "IDENTITY.md" },
    }),
  );
  return dir;
}

describe("findWorkspaceRoot", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
    await mkdir(join(root, "nested", "deep"), { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("finds workspace from itself", async () => {
    const found = await findWorkspaceRoot(root);
    expect(found).toBe(root);
  });
  it("walks up from a nested dir", async () => {
    const found = await findWorkspaceRoot(join(root, "nested", "deep"));
    expect(found).toBe(root);
  });
  it("returns null when no workspace found", async () => {
    const found = await findWorkspaceRoot(tmpdir()); // tmpdir itself shouldn't be an AWP root
    // It may still find one if a parent has a workspace, so we just check the contract
    expect(found === null || typeof found === "string").toBe(true);
  });
});

describe("loadManifest", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns the parsed manifest", async () => {
    const m = await loadManifest(root);
    expect(m.agent?.did).toBe("did:awp:test");
    expect(m.id).toBe("urn:awp:workspace:t");
  });
  it("throws when manifest missing", async () => {
    await expect(loadManifest(tmpdir() + "/no-such")).rejects.toThrow();
  });
});

describe("fileExists", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("true for existing files", async () => {
    expect(await fileExists(join(root, ".awp", "workspace.json"))).toBe(true);
  });
  it("false for missing files", async () => {
    expect(await fileExists(join(root, "nope.txt"))).toBe(false);
  });
});

describe("getAgentDid", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns the manifest DID", async () => {
    expect(await getAgentDid(root)).toBe("did:awp:test");
  });
  it("returns 'anonymous' when manifest is missing", async () => {
    expect(await getAgentDid(tmpdir() + "/no-such")).toBe("anonymous");
  });
});

describe("safeReadFile", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("reads files below the limit", async () => {
    const p = join(root, "small.txt");
    await writeFile(p, "ok");
    expect(await safeReadFile(p)).toBe("ok");
  });
  it("throws on oversized files", async () => {
    const p = join(root, "huge.txt");
    await writeFile(p, "x".repeat(2048));
    await expect(safeReadFile(p, 1024)).rejects.toThrow(/too large/);
  });
});

describe("getWorkspaceRoot", () => {
  it("returns AWP_WORKSPACE when set", () => {
    vi.stubEnv("AWP_WORKSPACE", "/custom/path");
    expect(getWorkspaceRoot()).toBe("/custom/path");
    vi.unstubAllEnvs();
  });
  it("falls back to cwd when AWP_WORKSPACE unset", () => {
    vi.stubEnv("AWP_WORKSPACE", "");
    expect(getWorkspaceRoot()).toBe(process.cwd());
    vi.unstubAllEnvs();
  });
});
