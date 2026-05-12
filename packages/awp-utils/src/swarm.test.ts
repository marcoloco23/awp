import { describe, it, expect } from "vitest";
import {
  findCandidatesForRole,
  autoRecruitSwarm,
  isSwarmFullyStaffed,
  getSwarmStaffingSummary,
} from "./swarm.js";
import type {
  ReputationProfileFrontmatter,
  ReputationDimension,
  SwarmFrontmatter,
  SwarmRole,
} from "@agent-workspace/core";

const NOW = new Date("2026-05-12T00:00:00Z");

const dim = (score: number, sampleSize = 10): ReputationDimension => ({
  score,
  confidence: 0.5,
  sampleSize,
  lastSignal: NOW.toISOString(),
});

const profile = (
  slug: string,
  dimensions: Record<string, ReputationDimension> = {},
  domainCompetence: Record<string, ReputationDimension> = {},
): ReputationProfileFrontmatter => ({
  awp: "1.0.0",
  type: "reputation-profile",
  rdp: "1.0.0",
  id: `reputation:${slug}`,
  agentDid: `did:awp:${slug}`,
  agentName: slug,
  lastUpdated: NOW.toISOString(),
  dimensions,
  domainCompetence,
  signals: [],
});

const role = (name: string, count: number, minReputation?: Record<string, number>): SwarmRole => ({
  name,
  count,
  minReputation,
  assigned: [],
});

const swarm = (roles: SwarmRole[]): SwarmFrontmatter => ({
  awp: "1.0.0",
  type: "swarm",
  cdp: "1.0.0",
  id: "swarm:test",
  name: "Test Swarm",
  goal: "Testing",
  status: "recruiting",
  created: NOW.toISOString(),
  roles,
});

describe("findCandidatesForRole", () => {
  it("marks qualified agents who meet all thresholds", () => {
    const r = role("researcher", 1, { reliability: 0.7 });
    const candidates = findCandidatesForRole(
      r,
      [profile("alice", { reliability: dim(0.9) }), profile("bob", { reliability: dim(0.5) })],
      NOW,
    );
    const alice = candidates.find((c) => c.slug === "alice");
    const bob = candidates.find((c) => c.slug === "bob");
    expect(alice?.qualifies).toBe(true);
    expect(bob?.qualifies).toBe(false);
    expect(bob?.gaps).toContain("reliability");
  });

  it("understands domain-competence:<domain> dimensions", () => {
    const r = role("dev", 1, { "domain-competence:typescript": 0.6 });
    const candidates = findCandidatesForRole(
      r,
      [profile("alice", {}, { typescript: dim(0.9) })],
      NOW,
    );
    expect(candidates[0].qualifies).toBe(true);
  });

  it("marks missing dimensions as gaps", () => {
    const r = role("x", 1, { reliability: 0.5 });
    const candidates = findCandidatesForRole(r, [profile("alice", {})], NOW);
    expect(candidates[0].qualifies).toBe(false);
    expect(candidates[0].gaps).toContain("reliability");
  });

  it("skips agents already assigned to that role", () => {
    const r: SwarmRole = {
      name: "x",
      count: 1,
      minReputation: { reliability: 0.5 },
      assigned: ["did:awp:alice"],
    };
    const candidates = findCandidatesForRole(r, [profile("alice", { reliability: dim(0.9) })], NOW);
    expect(candidates).toHaveLength(0);
  });

  it("sorts qualified candidates first, then by avg score desc", () => {
    const r = role("x", 5, { reliability: 0.6 });
    const candidates = findCandidatesForRole(
      r,
      [
        profile("low", { reliability: dim(0.7) }),
        profile("high", { reliability: dim(0.95) }),
        profile("fail", { reliability: dim(0.1) }),
      ],
      NOW,
    );
    expect(candidates[0].slug).toBe("high");
    expect(candidates[1].slug).toBe("low");
    expect(candidates[2].qualifies).toBe(false);
  });
});

describe("autoRecruitSwarm", () => {
  it("fills roles with qualified candidates", () => {
    const s = swarm([role("researcher", 2, { reliability: 0.7 })]);
    const results = autoRecruitSwarm(
      s,
      [profile("a", { reliability: dim(0.9) }), profile("b", { reliability: dim(0.85) })],
      NOW,
    );
    expect(results[0].assigned).toHaveLength(2);
    expect(results[0].unfilled).toBe(0);
  });

  it("reports unfilled count when not enough qualified candidates", () => {
    const s = swarm([role("researcher", 2, { reliability: 0.9 })]);
    const results = autoRecruitSwarm(
      s,
      [profile("a", { reliability: dim(0.95) }), profile("b", { reliability: dim(0.5) })],
      NOW,
    );
    expect(results[0].assigned).toHaveLength(1);
    expect(results[0].unfilled).toBe(1);
  });

  it("does not assign the same agent to two roles", () => {
    const s = swarm([
      role("researcher", 1, { reliability: 0.6 }),
      role("writer", 1, { reliability: 0.6 }),
    ]);
    const results = autoRecruitSwarm(s, [profile("a", { reliability: dim(0.9) })], NOW);
    const all = results.flatMap((r) => r.assigned);
    expect(all.length).toBeLessThanOrEqual(1);
  });

  it("returns zero-unfilled for already-fully-staffed roles", () => {
    const s: SwarmFrontmatter = swarm([
      { name: "x", count: 1, assigned: ["did:awp:other"] },
    ]);
    const results = autoRecruitSwarm(s, [profile("a", { reliability: dim(0.9) })], NOW);
    expect(results[0].unfilled).toBe(0);
    expect(results[0].assigned).toEqual([]);
  });
});

describe("isSwarmFullyStaffed", () => {
  it("true when every role is filled", () => {
    const s = swarm([{ name: "x", count: 2, assigned: ["did:awp:a", "did:awp:b"] }]);
    expect(isSwarmFullyStaffed(s)).toBe(true);
  });
  it("false when any role is short", () => {
    const s = swarm([{ name: "x", count: 2, assigned: ["did:awp:a"] }]);
    expect(isSwarmFullyStaffed(s)).toBe(false);
  });
});

describe("getSwarmStaffingSummary", () => {
  it("aggregates filled/needed/total across roles", () => {
    const s = swarm([
      { name: "r", count: 2, assigned: ["did:awp:a"] },
      { name: "w", count: 1, assigned: [] },
    ]);
    const summary = getSwarmStaffingSummary(s);
    expect(summary.filled).toBe(1);
    expect(summary.needed).toBe(2);
    expect(summary.total).toBe(3);
    expect(summary.byRole).toHaveLength(2);
  });
});
