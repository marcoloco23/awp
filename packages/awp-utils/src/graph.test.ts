import { describe, it, expect } from "vitest";
import {
  buildGraph,
  topologicalSort,
  detectCycles,
  findCriticalPath,
  getBlockedTasks,
  analyzeGraph,
  getTaskSlug,
  getProjectSlug,
  type TaskNode,
} from "./graph.js";

const t = (
  id: string,
  blockedBy: string[] = [],
  blocks: string[] = [],
  status = "pending",
): TaskNode => ({ id, blockedBy, blocks, status });

describe("buildGraph", () => {
  it("creates nodes for every task and only edges between known nodes", () => {
    const tasks = [
      t("task:p/a"),
      t("task:p/b", ["task:p/a"]),
      t("task:p/c", ["task:p/missing"]), // unknown dep ignored
    ];
    const g = buildGraph(tasks);
    expect(g.nodes.size).toBe(3);
    expect(g.inEdges.get("task:p/b")?.has("task:p/a")).toBe(true);
    expect(g.inEdges.get("task:p/c")?.size).toBe(0);
    expect(g.outEdges.get("task:p/a")?.has("task:p/b")).toBe(true);
  });
});

describe("topologicalSort", () => {
  it("orders dependencies first", () => {
    const g = buildGraph([
      t("task:p/a"),
      t("task:p/b", ["task:p/a"]),
      t("task:p/c", ["task:p/b"]),
    ]);
    const sorted = topologicalSort(g)!;
    expect(sorted.indexOf("task:p/a")).toBeLessThan(sorted.indexOf("task:p/b"));
    expect(sorted.indexOf("task:p/b")).toBeLessThan(sorted.indexOf("task:p/c"));
  });

  it("returns null on cycles", () => {
    const g = buildGraph([
      t("task:p/a", ["task:p/b"]),
      t("task:p/b", ["task:p/a"]),
    ]);
    expect(topologicalSort(g)).toBeNull();
  });

  it("handles isolated nodes", () => {
    const g = buildGraph([t("task:p/a"), t("task:p/b")]);
    const sorted = topologicalSort(g)!;
    expect(sorted).toHaveLength(2);
  });
});

describe("detectCycles", () => {
  it("returns empty for DAG", () => {
    const g = buildGraph([t("task:p/a"), t("task:p/b", ["task:p/a"])]);
    expect(detectCycles(g)).toEqual([]);
  });
  it("detects a simple 2-cycle", () => {
    const g = buildGraph([
      t("task:p/a", ["task:p/b"]),
      t("task:p/b", ["task:p/a"]),
    ]);
    const cycles = detectCycles(g);
    expect(cycles.length).toBeGreaterThan(0);
  });
});

describe("findCriticalPath", () => {
  it("returns the longest chain", () => {
    const g = buildGraph([
      t("task:p/a"),
      t("task:p/b", ["task:p/a"]),
      t("task:p/c", ["task:p/b"]),
      t("task:p/x"), // isolated
    ]);
    const cp = findCriticalPath(g);
    expect(cp.length).toBeGreaterThanOrEqual(3);
  });
});

describe("getBlockedTasks", () => {
  it("marks pending task blocked by incomplete dep", () => {
    const g = buildGraph([
      t("task:p/a", [], [], "pending"),
      t("task:p/b", ["task:p/a"], [], "pending"),
    ]);
    const blocked = getBlockedTasks(g);
    expect(blocked.get("task:p/b")).toEqual(["task:p/a"]);
  });
  it("excludes completed dependencies", () => {
    const g = buildGraph([
      t("task:p/a", [], [], "completed"),
      t("task:p/b", ["task:p/a"], [], "pending"),
    ]);
    expect(getBlockedTasks(g).has("task:p/b")).toBe(false);
  });
  it("does not list completed/cancelled tasks as blocked", () => {
    const g = buildGraph([
      t("task:p/a", [], [], "pending"),
      t("task:p/b", ["task:p/a"], [], "completed"),
      t("task:p/c", ["task:p/a"], [], "cancelled"),
    ]);
    const blocked = getBlockedTasks(g);
    expect(blocked.has("task:p/b")).toBe(false);
    expect(blocked.has("task:p/c")).toBe(false);
  });
});

describe("analyzeGraph", () => {
  it("returns valid DAG analysis", () => {
    const r = analyzeGraph([
      t("task:p/a"),
      t("task:p/b", ["task:p/a"]),
    ]);
    expect(r.isValid).toBe(true);
    expect(r.sorted).not.toBeNull();
    expect(r.cycles).toEqual([]);
  });
  it("flags invalid graph with cycles", () => {
    const r = analyzeGraph([
      t("task:p/a", ["task:p/b"]),
      t("task:p/b", ["task:p/a"]),
    ]);
    expect(r.isValid).toBe(false);
    expect(r.cycles.length).toBeGreaterThan(0);
  });
});

describe("slug helpers", () => {
  it("getTaskSlug pulls last segment", () => {
    expect(getTaskSlug("task:q3-launch/research")).toBe("research");
  });
  it("getProjectSlug pulls project prefix", () => {
    expect(getProjectSlug("task:q3-launch/research")).toBe("q3-launch");
    expect(getProjectSlug("not-a-task-id")).toBe("");
  });
});
