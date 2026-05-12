import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import {
  validateSlug,
  slugToSwarmPath,
  loadSwarm,
  listSwarms,
  ensureSwarmsDir,
} from "./swarm.js";
import type { SwarmFrontmatter } from "@agent-workspace/core";

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-cli-s-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, "swarms"), { recursive: true });
  return dir;
}

function buildSwarm(slug: string): string {
  const fm: SwarmFrontmatter = {
    awp: "1.0.0",
    type: "swarm",
    cdp: "1.0.0",
    id: `swarm:${slug}`,
    name: slug,
    goal: "test",
    status: "recruiting",
    created: new Date().toISOString(),
    roles: [],
  };
  return matter.stringify("\n# Swarm\n", fm as unknown as Record<string, unknown>);
}

describe("validateSlug", () => {
  it("matches expected patterns", () => {
    expect(validateSlug("ok")).toBe(true);
    expect(validateSlug("-no")).toBe(false);
  });
});

describe("slugToSwarmPath", () => {
  it("composes swarms/<slug>.md", () => {
    expect(slugToSwarmPath("/w", "s")).toBe(join("/w", "swarms", "s.md"));
  });
});

describe("ensureSwarmsDir", () => {
  let root: string;
  beforeEach(async () => {
    root = join(tmpdir(), `awp-cli-se-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(root, { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates the swarms directory if missing", async () => {
    await ensureSwarmsDir(root);
    expect(await listSwarms(root)).toEqual([]);
  });
});

describe("loadSwarm + listSwarms", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("loads a swarm by slug", async () => {
    await writeFile(join(root, "swarms", "s.md"), buildSwarm("s"));
    const s = await loadSwarm(root, "s");
    expect(s.frontmatter.id).toBe("swarm:s");
  });

  it("lists only type=swarm files and skips unparseable", async () => {
    await writeFile(join(root, "swarms", "a.md"), buildSwarm("a"));
    await writeFile(join(root, "swarms", "broken.md"), "not yaml ---\n");
    await writeFile(
      join(root, "swarms", "note.md"),
      matter.stringify("\n# Note\n", { awp: "1.0.0", type: "other" }),
    );
    const list = await listSwarms(root);
    expect(list).toHaveLength(1);
    expect(list[0].frontmatter.id).toBe("swarm:a");
  });

  it("listSwarms returns empty when dir missing", async () => {
    await rm(join(root, "swarms"), { recursive: true });
    expect(await listSwarms(root)).toEqual([]);
  });
});
