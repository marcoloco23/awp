import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("node:fs/promises", () => {
  const fns = {
    readFile: vi.fn(),
    readdir: vi.fn(),
    access: vi.fn(),
  };
  return { ...fns, default: fns };
});

vi.mock("gray-matter", () => ({
  default: vi.fn(),
}));

vi.mock("@agent-workspace/utils", () => ({
  computeDecayedScore: vi.fn((_dim: unknown) => 0.75),
}));

import { readFile, readdir, access } from "node:fs/promises";
import matter from "gray-matter";
import {
  readManifest,
  readIdentity,
  readSoul,
  listProjects,
  readProject,
  listReputationProfiles,
  readReputationProfile,
  listArtifacts,
  readArtifact,
  listContracts,
  readMemoryLogs,
  readLongTermMemory,
  computeWorkspaceHealth,
  computeStats,
  listSocieties,
  readSocietyDetail,
  readExperiment,
  computeCycleDataPoints,
  computeReputationTimeline,
} from "./reader";

const mockReadFile = vi.mocked(readFile);
const mockReaddir = vi.mocked(readdir);
const mockAccess = vi.mocked(access);
const mockMatter = vi.mocked(matter);

const ROOT = "/test/workspace";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AWP_WORKSPACE = ROOT;
});

// ---------------------------------------------------------------------------
// Helper: make gray-matter return structured data
// ---------------------------------------------------------------------------

function mockGrayMatter(data: Record<string, unknown>, content = "") {
  mockMatter.mockReturnValue({ data, content, orig: "", language: "", matter: "", stringify: () => "" } as never);
}

// ---------------------------------------------------------------------------
// readManifest
// ---------------------------------------------------------------------------

describe("readManifest", () => {
  it("returns parsed workspace.json", async () => {
    const manifest = { version: "0.4.0", name: "test-workspace" };
    mockReadFile.mockResolvedValue(JSON.stringify(manifest));

    const result = await readManifest();
    expect(result).toEqual(manifest);
    expect(mockReadFile).toHaveBeenCalledWith(`${ROOT}/.awp/workspace.json`, "utf-8");
  });

  it("returns null when file does not exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readManifest();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readIdentity
// ---------------------------------------------------------------------------

describe("readIdentity", () => {
  it("returns parsed identity frontmatter and body", async () => {
    const data = { name: "Clawd", emoji: "\u{1F43E}", capabilities: ["coding", "research"] };
    const body = "Identity body text";
    mockReadFile.mockResolvedValue("---\nname: Clawd\n---\nIdentity body text");
    mockGrayMatter(data, body);

    const result = await readIdentity();
    expect(result).toEqual({ frontmatter: data, body });
    expect(mockReadFile).toHaveBeenCalledWith(`${ROOT}/IDENTITY.md`, "utf-8");
  });

  it("returns null when IDENTITY.md is missing", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readIdentity();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// readSoul
// ---------------------------------------------------------------------------

describe("readSoul", () => {
  it("returns parsed soul frontmatter and body", async () => {
    const data = { vibe: "Curious and methodical" };
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter(data, "Soul text");

    const result = await readSoul();
    expect(result).toEqual({ frontmatter: data, body: "Soul text" });
    expect(mockReadFile).toHaveBeenCalledWith(`${ROOT}/SOUL.md`, "utf-8");
  });

  it("returns null when SOUL.md is missing", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readSoul();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listProjects
// ---------------------------------------------------------------------------

describe("listProjects", () => {
  it("returns project summaries from markdown files", async () => {
    mockReaddir.mockResolvedValue(["alpha.md", "beta.md", "README.txt"] as never);
    mockReadFile.mockResolvedValue("raw");

    let callCount = 0;
    mockMatter.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          data: {
            type: "project",
            title: "Alpha",
            status: "active",
            taskCount: 5,
            completedCount: 2,
            owner: "clawd",
            members: ["clawd", "bot-2"],
            tags: ["web"],
          },
          content: "",
          orig: "",
          language: "",
          matter: "",
          stringify: () => "",
        } as never;
      }
      return {
        data: {
          type: "project",
          title: "Beta",
          status: "completed",
          taskCount: 3,
          completedCount: 3,
          owner: "research-bot",
          members: ["research-bot"],
        },
        content: "",
        orig: "",
        language: "",
        matter: "",
        stringify: () => "",
      } as never;
    });

    const result = await listProjects();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      slug: "alpha",
      title: "Alpha",
      status: "active",
      taskCount: 5,
      completedCount: 2,
      owner: "clawd",
      memberCount: 2,
      tags: ["web"],
    });
    expect(result[1]).toMatchObject({
      slug: "beta",
      title: "Beta",
      status: "completed",
    });
  });

  it("filters by status when statusFilter is provided", async () => {
    mockReaddir.mockResolvedValue(["alpha.md", "beta.md"] as never);
    mockReadFile.mockResolvedValue("raw");

    let callCount = 0;
    mockMatter.mockImplementation(() => {
      callCount++;
      const status = callCount === 1 ? "active" : "completed";
      return {
        data: { type: "project", title: `Project ${callCount}`, status, taskCount: 1, completedCount: 0, owner: "test" },
        content: "",
        orig: "",
        language: "",
        matter: "",
        stringify: () => "",
      } as never;
    });

    const result = await listProjects("active");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("active");
  });

  it("skips files that are not of type 'project'", async () => {
    mockReaddir.mockResolvedValue(["task.md"] as never);
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({ type: "task", title: "Not a project" });

    const result = await listProjects();
    expect(result).toHaveLength(0);
  });

  it("returns empty array when directory does not exist", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const result = await listProjects();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// readProject
// ---------------------------------------------------------------------------

describe("readProject", () => {
  it("returns project detail with tasks", async () => {
    // First call: project file read
    // Then: task directory listing and individual task reads
    mockReadFile.mockImplementation(async () => {
      return "raw";
    });

    mockReaddir.mockResolvedValue(["task-a.md", "task-b.md"] as never);

    let matterCount = 0;
    mockMatter.mockImplementation(() => {
      matterCount++;
      if (matterCount === 1) {
        // Project file
        return {
          data: { type: "project", title: "Alpha", status: "active" },
          content: "Project body",
          orig: "",
          language: "",
          matter: "",
          stringify: () => "",
        } as never;
      }
      if (matterCount === 2) {
        // Task A
        return {
          data: { type: "task", title: "Task A", status: "completed", priority: "high", blockedBy: [], blocks: ["task-b"] },
          content: "",
          orig: "",
          language: "",
          matter: "",
          stringify: () => "",
        } as never;
      }
      // Task B
      return {
        data: { type: "task", title: "Task B", status: "in-progress", priority: "medium", blockedBy: ["task-a"], blocks: [] },
        content: "",
        orig: "",
        language: "",
        matter: "",
        stringify: () => "",
      } as never;
    });

    const result = await readProject("alpha");
    expect(result).not.toBeNull();
    expect(result!.body).toBe("Project body");
    expect(result!.tasks).toHaveLength(2);
    expect(result!.tasks[0]).toMatchObject({
      slug: "task-a",
      title: "Task A",
      status: "completed",
      priority: "high",
      blocks: ["task-b"],
    });
    expect(result!.tasks[1]).toMatchObject({
      slug: "task-b",
      title: "Task B",
      status: "in-progress",
      blockedBy: ["task-a"],
    });
  });

  it("returns null when project file does not exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readProject("nonexistent");
    expect(result).toBeNull();
  });

  it("returns project with empty tasks when tasks dir is missing", async () => {
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({ type: "project", title: "Solo", status: "active" }, "Body");
    mockReaddir.mockRejectedValue(new Error("ENOENT"));

    const result = await readProject("solo");
    expect(result).not.toBeNull();
    expect(result!.tasks).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// listReputationProfiles
// ---------------------------------------------------------------------------

describe("listReputationProfiles", () => {
  it("returns reputation summaries with dimensions", async () => {
    mockReaddir.mockResolvedValue(["clawd.md"] as never);
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({
      type: "reputation-profile",
      agentName: "Clawd",
      agentDid: "did:awp:clawd",
      lastUpdated: "2026-01-30",
      dimensions: {
        reliability: { score: 0.85, confidence: 0.9, sampleSize: 10, lastSignal: "2026-01-30" },
        "epistemic-hygiene": { score: 0.78, confidence: 0.7, sampleSize: 8, lastSignal: "2026-01-29" },
      },
      domainCompetence: {
        coding: { score: 0.92, confidence: 0.85, sampleSize: 15, lastSignal: "2026-01-30" },
      },
      signals: [{ type: "positive" }, { type: "positive" }, { type: "negative" }],
    });

    const result = await listReputationProfiles();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "clawd",
      agentName: "Clawd",
      agentDid: "did:awp:clawd",
      signalCount: 3,
      domainCount: 1,
      lastUpdated: "2026-01-30",
    });
    expect(result[0].dimensions).toHaveLength(2);
    expect(result[0].dimensions[0]).toMatchObject({
      name: "reliability",
      score: 0.85,
      decayedScore: 0.75, // from mock
    });
  });

  it("skips files that are not reputation-profile type", async () => {
    mockReaddir.mockResolvedValue(["other.md"] as never);
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({ type: "project", title: "Not a profile" });

    const result = await listReputationProfiles();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// readReputationProfile
// ---------------------------------------------------------------------------

describe("readReputationProfile", () => {
  it("returns full profile with dimensions, domains, and signals", async () => {
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter(
      {
        type: "reputation-profile",
        agentName: "Clawd",
        dimensions: {
          reliability: { score: 0.85, confidence: 0.9, sampleSize: 10, lastSignal: "2026-01-30" },
        },
        domainCompetence: {
          coding: { score: 0.92, confidence: 0.85, sampleSize: 15, lastSignal: "2026-01-30" },
        },
        signals: [{ type: "positive", dimension: "reliability", delta: 0.05, timestamp: "2026-01-30" }],
      },
      "Profile notes",
    );

    const result = await readReputationProfile("clawd");
    expect(result).not.toBeNull();
    expect(result!.body).toBe("Profile notes");
    expect(result!.dimensions).toHaveLength(1);
    expect(result!.dimensions[0].name).toBe("reliability");
    expect(result!.domains).toHaveLength(1);
    expect(result!.domains[0].name).toBe("coding");
    expect(result!.signals).toHaveLength(1);
  });

  it("returns null when profile does not exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readReputationProfile("nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listArtifacts
// ---------------------------------------------------------------------------

describe("listArtifacts", () => {
  it("returns artifact summaries", async () => {
    mockReaddir.mockResolvedValue(["design-doc.md"] as never);
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({
      type: "knowledge-artifact",
      title: "Design Document",
      confidence: 0.85,
      version: 3,
      tags: ["architecture", "api"],
      authors: ["clawd", "human"],
      created: "2026-01-15",
      lastModified: "2026-01-28",
    });

    const result = await listArtifacts();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "design-doc",
      title: "Design Document",
      confidence: 0.85,
      version: 3,
      tags: ["architecture", "api"],
      authors: ["clawd", "human"],
      created: "2026-01-15",
      lastModified: "2026-01-28",
    });
  });

  it("filters by tag", async () => {
    mockReaddir.mockResolvedValue(["a.md", "b.md"] as never);
    mockReadFile.mockResolvedValue("raw");

    let callCount = 0;
    mockMatter.mockImplementation(() => {
      callCount++;
      const tags = callCount === 1 ? ["api"] : ["frontend"];
      return {
        data: { type: "knowledge-artifact", title: `Art ${callCount}`, tags, authors: [], created: "2026-01-01" },
        content: "",
        orig: "",
        language: "",
        matter: "",
        stringify: () => "",
      } as never;
    });

    const result = await listArtifacts("api");
    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("a");
  });

  it("skips non-artifact files", async () => {
    mockReaddir.mockResolvedValue(["task.md"] as never);
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({ type: "task", title: "Not an artifact" });

    const result = await listArtifacts();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// readArtifact
// ---------------------------------------------------------------------------

describe("readArtifact", () => {
  it("returns artifact detail", async () => {
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter(
      { type: "knowledge-artifact", title: "Design Doc", confidence: 0.85 },
      "Artifact body content",
    );

    const result = await readArtifact("design-doc");
    expect(result).not.toBeNull();
    expect(result!.body).toBe("Artifact body content");
    expect(result!.frontmatter.title).toBe("Design Doc");
  });

  it("returns null when artifact does not exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readArtifact("nonexistent");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// listContracts
// ---------------------------------------------------------------------------

describe("listContracts", () => {
  it("returns contract summaries with weighted scores", async () => {
    mockReaddir.mockResolvedValue(["auth-contract.md"] as never);
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({
      type: "delegation-contract",
      status: "evaluated",
      delegator: "human",
      delegate: "Clawd",
      delegateSlug: "clawd",
      task: { description: "Implement auth" },
      deadline: "2026-02-15",
      created: "2026-01-10",
      evaluation: {
        criteria: { correctness: 0.4, security: 0.3, quality: 0.3 },
        result: { correctness: 0.9, security: 0.85, quality: 0.8 },
      },
    });

    const result = await listContracts();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      slug: "auth-contract",
      status: "evaluated",
      delegator: "human",
      delegate: "Clawd",
      description: "Implement auth",
      hasEvaluation: true,
    });
    // Weighted: (0.9*0.4 + 0.85*0.3 + 0.8*0.3) / (0.4+0.3+0.3) = (0.36+0.255+0.24)/1.0 = 0.855 → 0.86
    expect(result[0].weightedScore).toBeCloseTo(0.86, 1);
  });

  it("returns undefined weightedScore when no evaluation result", async () => {
    mockReaddir.mockResolvedValue(["draft.md"] as never);
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({
      type: "delegation-contract",
      status: "active",
      delegator: "human",
      delegate: "Bot",
      delegateSlug: "bot",
      task: { description: "Write report" },
      created: "2026-01-10",
    });

    const result = await listContracts();
    expect(result).toHaveLength(1);
    expect(result[0].hasEvaluation).toBe(false);
    expect(result[0].weightedScore).toBeUndefined();
  });

  it("filters by status", async () => {
    mockReaddir.mockResolvedValue(["a.md", "b.md"] as never);
    mockReadFile.mockResolvedValue("raw");

    let callCount = 0;
    mockMatter.mockImplementation(() => {
      callCount++;
      const status = callCount === 1 ? "active" : "evaluated";
      return {
        data: {
          type: "delegation-contract",
          status,
          delegator: "human",
          delegate: "Bot",
          delegateSlug: "bot",
          task: { description: `Contract ${callCount}` },
          created: "2026-01-01",
        },
        content: "",
        orig: "",
        language: "",
        matter: "",
        stringify: () => "",
      } as never;
    });

    const result = await listContracts("evaluated");
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("evaluated");
  });
});

// ---------------------------------------------------------------------------
// readMemoryLogs
// ---------------------------------------------------------------------------

describe("readMemoryLogs", () => {
  it("returns daily log summaries sorted by date descending", async () => {
    mockReaddir.mockResolvedValue(["2026-01-28.md", "2026-01-29.md", "2026-01-30.md"] as never);
    mockReadFile.mockResolvedValue("raw");

    let callCount = 0;
    mockMatter.mockImplementation(() => {
      callCount++;
      const dates = ["2026-01-30", "2026-01-29", "2026-01-28"]; // reverse sorted
      const entryCounts = [3, 4, 2];
      const entries = Array.from({ length: entryCounts[callCount - 1] || 0 }, (_, i) => ({
        time: "10:00",
        content: `Entry ${i + 1}`,
        tags: ["test"],
      }));
      return {
        data: { date: dates[callCount - 1], entries },
        content: "",
        orig: "",
        language: "",
        matter: "",
        stringify: () => "",
      } as never;
    });

    const result = await readMemoryLogs();
    expect(result).toHaveLength(3);
    // Sorted reverse: 2026-01-30, 2026-01-29, 2026-01-28
    expect(result[0].date).toBe("2026-01-30");
    expect(result[0].entryCount).toBe(3);
    expect(result[1].date).toBe("2026-01-29");
    expect(result[1].entryCount).toBe(4);
  });

  it("respects limit parameter", async () => {
    mockReaddir.mockResolvedValue(["2026-01-28.md", "2026-01-29.md", "2026-01-30.md"] as never);
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({ date: "2026-01-30", entries: [] });

    const result = await readMemoryLogs(1);
    // Only reads 1 file
    expect(result).toHaveLength(1);
  });

  it("returns empty array when memory dir is missing", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const result = await readMemoryLogs();
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// readLongTermMemory
// ---------------------------------------------------------------------------

describe("readLongTermMemory", () => {
  it("returns parsed MEMORY.md", async () => {
    const data = { entries: [{ content: "Remember this" }], pinned: ["key fact"] };
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter(data, "Long term notes");

    const result = await readLongTermMemory();
    expect(result).toEqual({ frontmatter: data, body: "Long term notes" });
  });

  it("returns null when MEMORY.md is missing", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readLongTermMemory();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// computeWorkspaceHealth
// ---------------------------------------------------------------------------

describe("computeWorkspaceHealth", () => {
  it("returns ok:true when all files exist and no issues", async () => {
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue([] as never); // no contracts or reputation files
    mockReadFile.mockResolvedValue("raw");

    const result = await computeWorkspaceHealth();
    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when IDENTITY.md is missing", async () => {
    mockAccess.mockImplementation(async (path) => {
      if (String(path).includes("IDENTITY.md")) throw new Error("ENOENT");
    });
    mockReaddir.mockResolvedValue([] as never);

    const result = await computeWorkspaceHealth();
    expect(result.ok).toBe(false);
    expect(result.warnings).toContain("IDENTITY.md missing");
  });

  it("warns when SOUL.md is missing", async () => {
    mockAccess.mockImplementation(async (path) => {
      if (String(path).includes("SOUL.md")) throw new Error("ENOENT");
    });
    mockReaddir.mockResolvedValue([] as never);

    const result = await computeWorkspaceHealth();
    expect(result.warnings).toContain("SOUL.md missing");
  });

  it("warns when workspace.json is missing", async () => {
    mockAccess.mockImplementation(async (path) => {
      if (String(path).includes("workspace.json")) throw new Error("ENOENT");
    });
    mockReaddir.mockResolvedValue([] as never);

    const result = await computeWorkspaceHealth();
    expect(result.warnings).toContain(".awp/workspace.json missing");
  });

  it("warns about past-deadline active contracts", async () => {
    mockAccess.mockResolvedValue(undefined);
    // Contracts dir
    let readdirCount = 0;
    mockReaddir.mockImplementation(async () => {
      readdirCount++;
      if (readdirCount === 1) return ["overdue.md"] as never;
      return [] as never;
    });
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({
      type: "delegation-contract",
      status: "active",
      deadline: "2020-01-01", // far in the past
    });

    const result = await computeWorkspaceHealth();
    expect(result.warnings.some((w) => w.includes("overdue") && w.includes("past deadline"))).toBe(true);
  });

  it("warns about decaying reputation (>30 days since last update)", async () => {
    mockAccess.mockResolvedValue(undefined);
    let readdirCount = 0;
    mockReaddir.mockImplementation(async () => {
      readdirCount++;
      if (readdirCount === 1) return [] as never; // contracts dir empty
      return ["stale-agent.md"] as never; // reputation dir
    });
    mockReadFile.mockResolvedValue("raw");
    mockGrayMatter({
      type: "reputation-profile",
      lastUpdated: "2020-01-01", // very old
    });

    const result = await computeWorkspaceHealth();
    expect(result.warnings.some((w) => w.includes("stale-agent") && w.includes("decaying"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// computeStats
// ---------------------------------------------------------------------------

describe("computeStats", () => {
  it("aggregates counts from all data sources", async () => {
    // computeStats calls listProjects, readProject (for each), listArtifacts,
    // listContracts, listReputationProfiles, readMemoryLogs internally.
    // We route mocks based on the path argument to readdir/readFile.

    mockReaddir.mockImplementation(async (dir) => {
      const d = String(dir);
      if (d.endsWith("/projects")) return ["proj.md"] as never;
      if (d.endsWith("/proj/tasks")) return ["t1.md"] as never;
      if (d.endsWith("/artifacts")) return ["art.md"] as never;
      if (d.endsWith("/contracts")) return ["con.md"] as never;
      if (d.endsWith("/reputation")) return ["rep.md"] as never;
      if (d.endsWith("/memory")) return ["log.md"] as never;
      return [] as never;
    });

    mockReadFile.mockResolvedValue("raw");

    mockMatter.mockImplementation(() => {
      return {
        data: { type: "unknown" },
        content: "",
        orig: "",
        language: "",
        matter: "",
        stringify: () => "",
      } as never;
    });

    // Override readFile to vary content by path so we can distinguish in gray-matter
    mockReadFile.mockImplementation(async (path) => {
      return String(path); // pass path as content to gray-matter
    });

    mockMatter.mockImplementation((raw) => {
      const path = String(raw);
      if (path.endsWith("/projects/proj.md")) {
        return {
          data: { type: "project", title: "Proj", status: "active", taskCount: 3, completedCount: 1, owner: "test" },
          content: "", orig: "", language: "", matter: "", stringify: () => "",
        } as never;
      }
      if (path.includes("/proj/tasks/t1.md")) {
        return {
          data: { type: "task", title: "Task 1", status: "in-progress", priority: "medium", blockedBy: [], blocks: [] },
          content: "", orig: "", language: "", matter: "", stringify: () => "",
        } as never;
      }
      if (path.endsWith("/artifacts/art.md")) {
        return {
          data: { type: "knowledge-artifact", title: "Art", tags: [], authors: [], created: "2026-01-01" },
          content: "", orig: "", language: "", matter: "", stringify: () => "",
        } as never;
      }
      if (path.endsWith("/contracts/con.md")) {
        return {
          data: { type: "delegation-contract", status: "active", delegator: "h", delegate: "b", delegateSlug: "b", task: { description: "d" }, created: "2026-01-01" },
          content: "", orig: "", language: "", matter: "", stringify: () => "",
        } as never;
      }
      if (path.endsWith("/reputation/rep.md")) {
        return {
          data: { type: "reputation-profile", agentName: "Bot", dimensions: {}, domainCompetence: {}, signals: [] },
          content: "", orig: "", language: "", matter: "", stringify: () => "",
        } as never;
      }
      if (path.endsWith("/memory/log.md")) {
        return {
          data: { date: "2026-01-30", entries: [{ content: "log" }] },
          content: "", orig: "", language: "", matter: "", stringify: () => "",
        } as never;
      }
      return {
        data: {},
        content: "", orig: "", language: "", matter: "", stringify: () => "",
      } as never;
    });

    const result = await computeStats();
    expect(result.projects).toBe(1);
    expect(result.artifacts).toBe(1);
    expect(result.reputationProfiles).toBe(1);
    expect(result.memoryLogs).toBe(1);
    expect(result.tasks.total).toBe(3);
    expect(result.tasks.completed).toBe(1);
    expect(result.tasks.active).toBe(1);
    expect(result.contracts.total).toBe(1);
    expect(result.contracts.active).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Societies & Experiments
// ---------------------------------------------------------------------------

const SOCIETIES_ROOT = "/test/societies";

const sampleSocietyConfig = {
  id: "society-alpha",
  manifestoId: "manifesto:test-v1",
  path: "societies/society-alpha",
  createdAt: "2026-01-30T10:00:00Z",
  status: "active",
  agents: ["societies/society-alpha/agent-01", "societies/society-alpha/agent-02"],
  currentCycle: 3,
  seed: 42,
};

const sampleExperimentResult = {
  experimentId: "exp-society-alpha-123",
  manifestoId: "manifesto:test-v1",
  societyId: "society-alpha",
  startedAt: "2026-01-30T10:05:00Z",
  endedAt: "2026-01-30T10:15:00Z",
  totalCycles: 2,
  cycles: [
    {
      cycleNumber: 0,
      startedAt: "2026-01-30T10:05:00Z",
      endedAt: "2026-01-30T10:10:00Z",
      contractsCreated: ["c0"],
      tasksExecuted: [],
      reputationChanges: [
        { agentId: "did:awp:agent-01", dimension: "reliability", oldScore: 0.5, newScore: 0.6, delta: 0.1 },
      ],
      metrics: {
        tasksAttempted: 2,
        tasksSucceeded: 1,
        tasksFailed: 1,
        successRate: 0.5,
        totalTokens: 500,
        totalDurationMs: 5000,
        avgTaskDurationMs: 2500,
        antiPatternsDetected: [],
      },
    },
    {
      cycleNumber: 1,
      startedAt: "2026-01-30T10:10:00Z",
      endedAt: "2026-01-30T10:15:00Z",
      contractsCreated: ["c1"],
      tasksExecuted: [],
      reputationChanges: [
        { agentId: "did:awp:agent-01", dimension: "reliability", oldScore: 0.6, newScore: 0.7, delta: 0.1 },
        { agentId: "did:awp:agent-02", dimension: "reliability", oldScore: 0.5, newScore: 0.55, delta: 0.05 },
      ],
      metrics: {
        tasksAttempted: 2,
        tasksSucceeded: 2,
        tasksFailed: 0,
        successRate: 1.0,
        totalTokens: 800,
        totalDurationMs: 4000,
        avgTaskDurationMs: 2000,
        antiPatternsDetected: [],
      },
    },
  ],
  finalReputations: {
    "did:awp:agent-01": {
      agentDid: "did:awp:agent-01",
      agentName: "Agent 1",
      dimensions: { reliability: 0.7, "epistemic-hygiene": 0.5, coordination: 0.5 },
      overallScore: 0.57,
    },
    "did:awp:agent-02": {
      agentDid: "did:awp:agent-02",
      agentName: "Agent 2",
      dimensions: { reliability: 0.55, "epistemic-hygiene": 0.5, coordination: 0.5 },
      overallScore: 0.52,
    },
  },
  aggregateMetrics: {
    totalTasks: 4,
    totalSuccesses: 3,
    totalFailures: 1,
    overallSuccessRate: 0.75,
    totalTokens: 1300,
    totalDurationMs: 9000,
    avgCycleDurationMs: 4500,
  },
  successCriteriaResults: [
    { criterionId: "trust-stability", met: true, actualValue: 0.9, threshold: 0.6 },
    { criterionId: "artifact-quality", met: false, actualValue: 0.4, threshold: 0.7 },
  ],
};

describe("listSocieties", () => {
  beforeEach(() => {
    process.env.AWP_SOCIETIES = SOCIETIES_ROOT;
  });

  it("returns society summaries from society.json files", async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const d = String(dir);
      if (d === SOCIETIES_ROOT) {
        return [
          { name: "society-alpha", isDirectory: () => true },
          { name: "README.md", isDirectory: () => false },
        ] as never;
      }
      if (d.endsWith("/metrics")) return ["exp-123.json"] as never;
      return [] as never;
    });

    mockReadFile.mockImplementation(async (path) => {
      if (String(path).endsWith("society.json")) {
        return JSON.stringify(sampleSocietyConfig);
      }
      return "";
    });

    const result = await listSocieties();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "society-alpha",
      manifestoId: "manifesto:test-v1",
      status: "active",
      agentCount: 2,
      currentCycle: 3,
      experimentCount: 1,
    });
  });

  it("filters by status", async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const d = String(dir);
      if (d === SOCIETIES_ROOT) {
        return [{ name: "society-alpha", isDirectory: () => true }] as never;
      }
      if (d.endsWith("/metrics")) return [] as never;
      return [] as never;
    });

    mockReadFile.mockImplementation(async () => JSON.stringify(sampleSocietyConfig));

    const result = await listSocieties("archived");
    expect(result).toHaveLength(0);
  });

  it("returns empty array when societies dir does not exist", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT"));
    const result = await listSocieties();
    expect(result).toHaveLength(0);
  });

  it("skips directories without valid society.json", async () => {
    mockReaddir.mockImplementation(async (dir) => {
      const d = String(dir);
      if (d === SOCIETIES_ROOT) {
        return [{ name: "bad-dir", isDirectory: () => true }] as never;
      }
      return [] as never;
    });
    mockReadFile.mockRejectedValue(new Error("ENOENT"));

    const result = await listSocieties();
    expect(result).toHaveLength(0);
  });
});

describe("readSocietyDetail", () => {
  beforeEach(() => {
    process.env.AWP_SOCIETIES = SOCIETIES_ROOT;
  });

  it("returns full detail with agents and experiments", async () => {
    mockReadFile.mockImplementation(async (path) => {
      const p = String(path);
      if (p.endsWith("society.json")) return JSON.stringify(sampleSocietyConfig);
      if (p.includes("agent-01/IDENTITY.md")) return "---\nname: Agent 1\n---";
      if (p.includes("agent-02/IDENTITY.md")) return "---\nname: Agent 2\n---";
      if (p.endsWith(".json") && p.includes("metrics")) return JSON.stringify(sampleExperimentResult);
      return "";
    });

    mockMatter.mockImplementation((raw) => {
      const content = String(raw);
      if (content.includes("Agent 1")) {
        return { data: { name: "Agent 1", did: "did:awp:agent-01" }, content: "", orig: "", language: "", matter: "", stringify: () => "" } as never;
      }
      if (content.includes("Agent 2")) {
        return { data: { name: "Agent 2", did: "did:awp:agent-02" }, content: "", orig: "", language: "", matter: "", stringify: () => "" } as never;
      }
      return { data: {}, content: "", orig: "", language: "", matter: "", stringify: () => "" } as never;
    });

    mockReaddir.mockImplementation(async (dir) => {
      if (String(dir).endsWith("/metrics")) return ["exp-society-alpha-123.json"] as never;
      return [] as never;
    });

    const result = await readSocietyDetail("society-alpha");
    expect(result).not.toBeNull();
    expect(result!.agents).toHaveLength(2);
    expect(result!.agents[0].name).toBe("Agent 1");
    expect(result!.experiments).toHaveLength(1);
    expect(result!.experiments[0].overallSuccessRate).toBe(0.75);
  });

  it("returns null when society does not exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readSocietyDetail("nonexistent");
    expect(result).toBeNull();
  });

  it("handles missing metrics directory gracefully", async () => {
    mockReadFile.mockImplementation(async (path) => {
      const p = String(path);
      if (p.endsWith("society.json")) {
        return JSON.stringify({ ...sampleSocietyConfig, agents: [] });
      }
      throw new Error("ENOENT");
    });

    mockReaddir.mockRejectedValue(new Error("ENOENT"));

    const result = await readSocietyDetail("society-alpha");
    expect(result).not.toBeNull();
    expect(result!.experiments).toHaveLength(0);
  });
});

describe("readExperiment", () => {
  beforeEach(() => {
    process.env.AWP_SOCIETIES = SOCIETIES_ROOT;
  });

  it("returns parsed experiment result", async () => {
    mockReadFile.mockResolvedValue(JSON.stringify(sampleExperimentResult));

    const result = await readExperiment("society-alpha", "exp-society-alpha-123");
    expect(result).not.toBeNull();
    expect(result!.experimentId).toBe("exp-society-alpha-123");
    expect(result!.totalCycles).toBe(2);
    expect(result!.aggregateMetrics.overallSuccessRate).toBe(0.75);
  });

  it("returns null when experiment does not exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await readExperiment("society-alpha", "nonexistent");
    expect(result).toBeNull();
  });
});

describe("computeCycleDataPoints", () => {
  it("maps cycles to flat data points", () => {
    const result = computeCycleDataPoints(sampleExperimentResult as never);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      cycle: 0,
      successRate: 0.5,
      totalTokens: 500,
      tasksAttempted: 2,
      tasksSucceeded: 1,
      tasksFailed: 1,
    });
    expect(result[1]).toMatchObject({
      cycle: 1,
      successRate: 1.0,
      totalTokens: 800,
    });
  });

  it("handles empty cycles", () => {
    const empty = { ...sampleExperimentResult, cycles: [] };
    const result = computeCycleDataPoints(empty as never);
    expect(result).toHaveLength(0);
  });
});

describe("computeReputationTimeline", () => {
  it("produces correct timeline with initial and per-cycle points", () => {
    const result = computeReputationTimeline(sampleExperimentResult as never);
    expect(result.agents).toHaveLength(2);
    expect(result.agents[0].name).toBe("Agent 1");
    expect(result.agents[1].name).toBe("Agent 2");

    // 2 cycles + 1 initial = 3 points
    expect(result.points).toHaveLength(3);

    // Initial: both agents at 50
    expect(result.points[0]["did:awp:agent-01"]).toBe(50);
    expect(result.points[0]["did:awp:agent-02"]).toBe(50);

    // After cycle 0: agent-01 +0.1*100=10 → 60, agent-02 unchanged → 50
    expect(result.points[1]["did:awp:agent-01"]).toBe(60);
    expect(result.points[1]["did:awp:agent-02"]).toBe(50);

    // After cycle 1: agent-01 +0.1*100=10 → 70, agent-02 +0.05*100=5 → 55
    expect(result.points[2]["did:awp:agent-01"]).toBe(70);
    expect(result.points[2]["did:awp:agent-02"]).toBe(55);
  });

  it("handles experiment with single cycle", () => {
    const singleCycle = {
      ...sampleExperimentResult,
      cycles: [sampleExperimentResult.cycles[0]],
    };
    const result = computeReputationTimeline(singleCycle as never);
    expect(result.points).toHaveLength(2); // initial + 1 cycle
  });

  it("carries forward scores for agents with no changes in a cycle", () => {
    // In cycle 0, only agent-01 has changes; agent-02 should stay at 50
    const result = computeReputationTimeline(sampleExperimentResult as never);
    expect(result.points[1]["did:awp:agent-02"]).toBe(50);
  });
});
