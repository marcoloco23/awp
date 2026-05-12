import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import {
  validateSlug,
  slugToContractPath,
  loadContract,
  listContracts,
  evaluateContract,
} from "./contract.js";
import type { DelegationContractFrontmatter } from "@agent-workspace/core";

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-cli-c-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, "contracts"), { recursive: true });
  return dir;
}

function buildContract(slug: string, overrides: Partial<DelegationContractFrontmatter> = {}): string {
  const now = new Date().toISOString();
  const fm: DelegationContractFrontmatter = {
    awp: "1.0.0",
    rdp: "1.0.0",
    type: "delegation-contract",
    id: `contract:${slug}`,
    status: "active",
    delegator: "did:awp:a",
    delegate: "did:awp:b",
    delegateSlug: "b",
    created: now,
    task: { description: "do thing" },
    evaluation: { criteria: { accuracy: 0.6, clarity: 0.4 }, result: null },
    ...overrides,
  };
  return matter.stringify("\n# Contract\n", fm as unknown as Record<string, unknown>);
}

describe("validateSlug", () => {
  it("accepts simple slugs", () => {
    expect(validateSlug("research")).toBe(true);
    expect(validateSlug("q3-launch")).toBe(true);
  });
  it("rejects bad slugs", () => {
    expect(validateSlug("Research")).toBe(false);
    expect(validateSlug("-bad")).toBe(false);
    expect(validateSlug("a_b")).toBe(false);
  });
});

describe("slugToContractPath", () => {
  it("returns contracts/<slug>.md under workspace", () => {
    const p = slugToContractPath("/ws", "x");
    expect(p).toBe(join("/ws", "contracts", "x.md"));
  });
});

describe("loadContract", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("loads a contract by slug", async () => {
    await writeFile(join(root, "contracts", "x.md"), buildContract("x"));
    const c = await loadContract(root, "x");
    expect(c.frontmatter.id).toBe("contract:x");
    expect(c.frontmatter.type).toBe("delegation-contract");
  });
  it("throws for missing contract", async () => {
    await expect(loadContract(root, "missing")).rejects.toThrow();
  });
});

describe("listContracts", () => {
  let root: string;
  beforeEach(async () => {
    root = await makeWorkspace();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("returns empty array when no contracts dir", async () => {
    await rm(join(root, "contracts"), { recursive: true });
    expect(await listContracts(root)).toEqual([]);
  });

  it("lists only delegation-contract files", async () => {
    await writeFile(join(root, "contracts", "a.md"), buildContract("a"));
    await writeFile(join(root, "contracts", "b.md"), buildContract("b"));
    // Non-contract file should be skipped
    await writeFile(
      join(root, "contracts", "note.md"),
      matter.stringify("\n# Note\n", { awp: "1.0.0", type: "other" }),
    );
    const list = await listContracts(root);
    expect(list.map((c) => c.frontmatter.id).sort()).toEqual(["contract:a", "contract:b"]);
  });

  it("skips unparseable files", async () => {
    await writeFile(join(root, "contracts", "broken.md"), "not yaml ---\n");
    const list = await listContracts(root);
    expect(list).toHaveLength(0);
  });
});

describe("evaluateContract", () => {
  it("computes weighted score and emits a reliability signal", () => {
    const c = matter(buildContract("x")).data as unknown as DelegationContractFrontmatter;
    const result = evaluateContract(
      c,
      { accuracy: 0.9, clarity: 0.5 },
      "did:awp:eval",
      new Date("2026-05-12T00:00:00Z"),
    );
    // 0.6*0.9 + 0.4*0.5 = 0.74
    expect(result.weightedScore).toBe(0.74);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].dimension).toBe("reliability");
    expect(result.signals[0].score).toBe(0.74);
    expect(result.signals[0].evidence).toBe("contract:x");
  });

  it("throws when a criterion is missing from scores", () => {
    const c = matter(buildContract("x")).data as unknown as DelegationContractFrontmatter;
    expect(() => evaluateContract(c, { accuracy: 0.9 }, "did:awp:eval")).toThrow(/Missing score/);
  });
});
