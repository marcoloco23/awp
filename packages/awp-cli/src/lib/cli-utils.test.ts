import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { requireWorkspaceRoot } from "./cli-utils.js";

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-cli-cu-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({ awp: "1.0.0", name: "t", id: "urn:awp:workspace:t" }),
  );
  return dir;
}

describe("requireWorkspaceRoot", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = process.cwd();
  });
  afterEach(() => {
    process.chdir(cwd);
  });

  it("returns the workspace root when inside one", async () => {
    const root = await makeWorkspace();
    const realRoot = await realpath(root);
    process.chdir(realRoot);
    try {
      expect(await requireWorkspaceRoot()).toBe(realRoot);
    } finally {
      process.chdir(cwd);
      await rm(root, { recursive: true, force: true });
    }
  });

  it("exits when no workspace found", async () => {
    const empty = join(tmpdir(), `awp-empty-${Date.now()}`);
    await mkdir(empty, { recursive: true });
    process.chdir(empty);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(requireWorkspaceRoot()).rejects.toThrow("process.exit called");
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
      errSpy.mockRestore();
      process.chdir(cwd);
      await rm(empty, { recursive: true, force: true });
    }
  });
});
