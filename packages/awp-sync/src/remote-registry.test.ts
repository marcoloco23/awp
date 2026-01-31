import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { addRemote, removeRemote, listRemotes, getRemote } from "./remote-registry.js";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "awp-sync-registry-test-"));
  // Create .awp/sync directory
  await mkdir(join(testDir, ".awp", "sync"), { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("addRemote", () => {
  it("adds a remote to the registry", async () => {
    await addRemote(testDir, "origin", {
      url: "/tmp/other-workspace",
      transport: "local-fs",
    });

    const remotes = await listRemotes(testDir);
    expect(remotes["origin"]).toBeDefined();
    expect(remotes["origin"].url).toBe("/tmp/other-workspace");
    expect(remotes["origin"].transport).toBe("local-fs");
    expect(remotes["origin"].added).toBeDefined();
  });

  it("rejects duplicate remote names", async () => {
    await addRemote(testDir, "origin", {
      url: "/tmp/workspace-a",
      transport: "local-fs",
    });

    await expect(
      addRemote(testDir, "origin", {
        url: "/tmp/workspace-b",
        transport: "local-fs",
      })
    ).rejects.toThrow(/already exists/);
  });

  it("supports git-remote transport", async () => {
    await addRemote(testDir, "upstream", {
      url: "https://github.com/test/repo.git",
      transport: "git-remote",
    });

    const remote = await getRemote(testDir, "upstream");
    expect(remote).toBeDefined();
    expect(remote!.transport).toBe("git-remote");
  });
});

describe("removeRemote", () => {
  it("removes an existing remote", async () => {
    await addRemote(testDir, "origin", {
      url: "/tmp/workspace",
      transport: "local-fs",
    });

    await removeRemote(testDir, "origin");
    const remotes = await listRemotes(testDir);
    expect(remotes["origin"]).toBeUndefined();
  });

  it("throws when removing non-existent remote", async () => {
    await expect(removeRemote(testDir, "nonexistent")).rejects.toThrow(/not found/);
  });
});

describe("listRemotes", () => {
  it("returns empty object when no remotes configured", async () => {
    const remotes = await listRemotes(testDir);
    expect(remotes).toEqual({});
  });

  it("lists multiple remotes", async () => {
    await addRemote(testDir, "origin", {
      url: "/tmp/a",
      transport: "local-fs",
    });
    await addRemote(testDir, "upstream", {
      url: "/tmp/b",
      transport: "local-fs",
    });

    const remotes = await listRemotes(testDir);
    expect(Object.keys(remotes)).toHaveLength(2);
    expect(remotes["origin"]).toBeDefined();
    expect(remotes["upstream"]).toBeDefined();
  });
});

describe("getRemote", () => {
  it("returns undefined for non-existent remote", async () => {
    const remote = await getRemote(testDir, "nonexistent");
    expect(remote).toBeUndefined();
  });

  it("returns the remote configuration", async () => {
    await addRemote(testDir, "origin", {
      url: "/tmp/workspace",
      transport: "local-fs",
    });

    const remote = await getRemote(testDir, "origin");
    expect(remote).toBeDefined();
    expect(remote!.url).toBe("/tmp/workspace");
  });
});
