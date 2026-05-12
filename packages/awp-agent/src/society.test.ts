import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { generateSoulContent, parseManifesto, SocietyManager } from "./society.js";
import type { ManifestoConfig } from "./types.js";

const baseManifesto: ManifestoConfig = {
  id: "manifesto:test",
  name: "Test",
  version: "1.0.0",
  values: { reliability: 0.5, "epistemic-hygiene": 0.5 },
  fitness: { reliability: 1.0 },
  purity: { reliability: 0.4, "epistemic-hygiene": 0.4, coordination: 0.2 },
  constraints: {
    maxAgents: 10,
    maxConcurrentTasks: 5,
    maxContractsPerAgent: 3,
    taskBudgetPerCycle: 5,
    trustBudget: 10,
  },
  governance: { humanApprovalRequired: [], escalationThreshold: 0.3, vetoPower: false },
  lifecycle: { birthRequires: [], deathTriggers: [] },
  antiPatterns: [],
  successCriteria: [],
};

describe("generateSoulContent", () => {
  it("returns generic content when no manifesto provided", () => {
    const out = generateSoulContent();
    expect(out).toContain("Core Values");
    expect(out).toContain("Reliability");
    expect(out).toContain("Epistemic Hygiene");
  });

  it("incorporates manifesto values when provided", () => {
    const out = generateSoulContent(baseManifesto);
    expect(out).toContain("Test");
    expect(out).toContain("Reliability");
    expect(out).toContain("Epistemic Hygiene");
  });

  it("emits hedging-focused guidelines for epistemic-heavy manifestos", () => {
    const heavy: ManifestoConfig = {
      ...baseManifesto,
      purity: { reliability: 0.2, "epistemic-hygiene": 0.5, coordination: 0.3 },
    };
    const out = generateSoulContent(heavy);
    expect(out.toLowerCase()).toMatch(/uncertain|hedging|confidence/);
  });
});

describe("parseManifesto", () => {
  let root: string;
  beforeEach(async () => {
    root = join(tmpdir(), `awp-soc-mf-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(root, { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("parses a valid manifesto file", async () => {
    const p = join(root, "manifesto.md");
    await writeFile(
      p,
      matter.stringify("\n# Manifesto\n", {
        id: "manifesto:x",
        name: "X",
        version: "1.0.0",
        values: { reliability: 1.0 },
        purity: { reliability: 1.0 },
        fitness: { reliability: 1.0 },
      }),
    );
    const cfg = await parseManifesto(p);
    expect(cfg.id).toBe("manifesto:x");
    expect(cfg.name).toBe("X");
    expect(cfg.constraints.maxAgents).toBe(10);
    expect(cfg.governance.vetoPower).toBe(true);
  });

  it("throws when required fields are missing", async () => {
    const p = join(root, "missing.md");
    await writeFile(p, matter.stringify("\n# X\n", { name: "X" }));
    await expect(parseManifesto(p)).rejects.toThrow(/required field/);
  });

  it("parses the bundled baseline.md template", async () => {
    const path = "/Users/marcsperzel/code/ai-ml/awp/templates/manifestos/baseline.md";
    const cfg = await parseManifesto(path);
    expect(typeof cfg.id).toBe("string");
    expect(cfg.id.length).toBeGreaterThan(0);
  });
});

describe("SocietyManager.createSociety", () => {
  let root: string;
  beforeEach(async () => {
    root = join(tmpdir(), `awp-soc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(root, { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("creates society directory + agent workspaces", async () => {
    const mgr = new SocietyManager(root);
    const society = await mgr.createSociety("test-society", baseManifesto, 2, 42);
    expect(society.id).toBe("test-society");
    expect(society.agents).toHaveLength(2);
    await access(join(society.path, "society.json"));
    // Each agent should have its own workspace.json
    for (const a of society.agents) {
      await access(join(a, ".awp", "workspace.json"));
      await access(join(a, "IDENTITY.md"));
      await access(join(a, "SOUL.md"));
    }
  });

  it("writes society config containing the manifesto id and seed", async () => {
    const mgr = new SocietyManager(root);
    const society = await mgr.createSociety("s1", baseManifesto, 1, 99);
    const raw = await readFile(join(society.path, "society.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.manifestoId).toBe("manifesto:test");
    expect(parsed.seed).toBe(99);
  });
});
