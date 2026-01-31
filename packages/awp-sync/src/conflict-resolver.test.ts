import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { stashConflict, listConflicts, resolveConflict } from "./conflict-resolver.js";

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), "awp-sync-conflict-test-"));
  await mkdir(join(testDir, ".awp", "sync", "conflicts"), { recursive: true });
  await mkdir(join(testDir, "artifacts"), { recursive: true });
});

afterEach(async () => {
  await rm(testDir, { recursive: true, force: true });
});

describe("stashConflict", () => {
  it("creates remote copy and descriptor", async () => {
    const descriptor = await stashConflict(
      testDir,
      "test-artifact",
      "origin",
      2,
      3,
      "---\ntitle: Remote version\n---\nRemote content",
      "additive",
      "Both sides modified"
    );

    expect(descriptor.artifact).toBe("test-artifact");
    expect(descriptor.localVersion).toBe(2);
    expect(descriptor.remoteVersion).toBe(3);

    // Remote copy stashed
    const remoteCopy = await readFile(
      join(testDir, ".awp", "sync", "conflicts", "test-artifact.remote.md"),
      "utf-8"
    );
    expect(remoteCopy).toContain("Remote content");

    // Descriptor written
    const descriptorJson = JSON.parse(
      await readFile(
        join(testDir, ".awp", "sync", "conflicts", "test-artifact.conflict.json"),
        "utf-8"
      )
    );
    expect(descriptorJson.artifact).toBe("test-artifact");
    expect(descriptorJson.remote).toBe("origin");
  });
});

describe("listConflicts", () => {
  it("returns empty array when no conflicts", async () => {
    const conflicts = await listConflicts(testDir);
    expect(conflicts).toEqual([]);
  });

  it("lists stashed conflicts", async () => {
    await stashConflict(testDir, "artifact-a", "origin", 1, 2, "content-a", "additive", "reason a");
    await stashConflict(testDir, "artifact-b", "origin", 3, 5, "content-b", "additive", "reason b");

    const conflicts = await listConflicts(testDir);
    expect(conflicts).toHaveLength(2);
    const slugs = conflicts.map((c) => c.artifact);
    expect(slugs).toContain("artifact-a");
    expect(slugs).toContain("artifact-b");
  });
});

describe("resolveConflict", () => {
  it("resolves with 'local' — keeps local, cleans up", async () => {
    await writeFile(join(testDir, "artifacts", "test.md"), "local content", "utf-8");
    await stashConflict(testDir, "test", "origin", 1, 2, "remote content", "additive", "conflict");

    await resolveConflict(testDir, "test", "local");

    // Local file unchanged
    expect(await readFile(join(testDir, "artifacts", "test.md"), "utf-8")).toBe("local content");

    // Conflict files cleaned up
    expect(
      existsSync(join(testDir, ".awp", "sync", "conflicts", "test.conflict.json"))
    ).toBe(false);
    expect(
      existsSync(join(testDir, ".awp", "sync", "conflicts", "test.remote.md"))
    ).toBe(false);
  });

  it("resolves with 'remote' — overwrites local with remote copy", async () => {
    await writeFile(join(testDir, "artifacts", "test.md"), "local content", "utf-8");
    await stashConflict(testDir, "test", "origin", 1, 2, "remote content", "additive", "conflict");

    await resolveConflict(testDir, "test", "remote");

    // Local file replaced with remote
    expect(await readFile(join(testDir, "artifacts", "test.md"), "utf-8")).toBe("remote content");
  });

  it("throws when no conflict exists", async () => {
    await expect(resolveConflict(testDir, "nonexistent", "local")).rejects.toThrow(/No conflict/);
  });
});
