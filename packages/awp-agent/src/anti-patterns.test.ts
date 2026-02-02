import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ManifestoConfig, AgentAdapter } from "./types.js";

// Mock node:fs/promises before importing the module under test
vi.mock("node:fs/promises", () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

// Import after mock setup
import { readdir, readFile } from "node:fs/promises";
import { detectAntiPatterns } from "./anti-patterns.js";

const mockedReaddir = vi.mocked(readdir);
const mockedReadFile = vi.mocked(readFile);

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeAgent(id: string, workspace: string = "/tmp/test-workspace"): AgentAdapter {
  return {
    id,
    workspace,
    did: `did:awp:${id}`,
    executeTask: vi.fn(),
    getReputation: vi.fn(),
    getIdentity: vi.fn(),
  };
}

const BASE_MANIFESTO: ManifestoConfig = {
  id: "manifesto:test",
  name: "Test Manifesto",
  version: "1.0.0",
  values: { reliability: 0.5, coordination: 0.5 },
  fitness: { "goal-completion-rate": 0.5, "trust-stability": 0.5 },
  purity: { reliability: 0.5, "epistemic-hygiene": 0.5 },
  constraints: {
    maxAgents: 10,
    maxConcurrentTasks: 20,
    maxContractsPerAgent: 5,
    taskBudgetPerCycle: 10,
    trustBudget: 100,
  },
  governance: {
    humanApprovalRequired: [],
    escalationThreshold: 0.3,
    vetoPower: true,
  },
  lifecycle: { birthRequires: [], deathTriggers: [] },
  antiPatterns: [],
  successCriteria: [],
};

function makeManifestoWithPatterns(
  patterns: ManifestoConfig["antiPatterns"]
): ManifestoConfig {
  return { ...BASE_MANIFESTO, antiPatterns: patterns };
}

function recentTimestamp(hoursAgo: number = 1): string {
  return new Date(Date.now() - hoursAgo * 3600_000).toISOString();
}

function makeArtifactMd(created: string): string {
  return `---\ncreated: "${created}"\n---\n\n# Artifact\n`;
}

function makeReputationMd(
  agentDid: string,
  signals: Array<{ source: string; score: number; timestamp: string }>
): string {
  const yaml = signals
    .map(
      (s) =>
        `  - source: "${s.source}"\n    score: ${s.score}\n    timestamp: "${s.timestamp}"\n    dimension: reliability`
    )
    .join("\n");
  return `---\ntype: reputation-profile\nsignals:\n${yaml}\n---\n\n# Reputation\n`;
}

function makeContractMd(delegate: string, delegator: string, status: string): string {
  return `---\nstatus: "${status}"\ndelegate: "${delegate}"\ndelegator: "${delegator}"\n---\n\n# Contract\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
});

describe("detectAntiPatterns", () => {
  describe("artifact-spam detection", () => {
    it("detects artifact spam when agent exceeds threshold", async () => {
      const agent = makeAgent("spammer");
      const manifesto = makeManifestoWithPatterns([
        { id: "artifact-spam", detector: "artifact-spam-rate > 10/day", penalty: 0.2 },
      ]);

      // Create 15 recent artifact files
      const files = Array.from({ length: 15 }, (_, i) => `artifact-${i}.md`);
      mockedReaddir.mockResolvedValueOnce(files as any);

      for (const _ of files) {
        mockedReadFile.mockResolvedValueOnce(makeArtifactMd(recentTimestamp(2)) as any);
      }

      const detections = await detectAntiPatterns([agent], manifesto);

      expect(detections).toHaveLength(1);
      expect(detections[0].patternId).toBe("artifact-spam");
      expect(detections[0].agentId).toBe("spammer");
      expect(detections[0].penalty).toBe(0.2);
      expect(detections[0].evidence).toContain("15 artifacts");
    });

    it("does not flag agent below threshold", async () => {
      const agent = makeAgent("normal");
      const manifesto = makeManifestoWithPatterns([
        { id: "artifact-spam", detector: "artifact-spam-rate > 10/day", penalty: 0.2 },
      ]);

      // Create 5 recent artifact files (below threshold of 10)
      const files = Array.from({ length: 5 }, (_, i) => `artifact-${i}.md`);
      mockedReaddir.mockResolvedValueOnce(files as any);

      for (const _ of files) {
        mockedReadFile.mockResolvedValueOnce(makeArtifactMd(recentTimestamp(2)) as any);
      }

      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });

    it("ignores old artifacts outside the window", async () => {
      const agent = makeAgent("old-writer");
      const manifesto = makeManifestoWithPatterns([
        { id: "artifact-spam", detector: "artifact-spam-rate > 10/day", penalty: 0.2 },
      ]);

      // Create 15 artifacts but all are old (48+ hours ago)
      const files = Array.from({ length: 15 }, (_, i) => `artifact-${i}.md`);
      mockedReaddir.mockResolvedValueOnce(files as any);

      for (const _ of files) {
        mockedReadFile.mockResolvedValueOnce(makeArtifactMd(recentTimestamp(48)) as any);
      }

      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });

    it("handles missing artifacts directory gracefully", async () => {
      const agent = makeAgent("no-artifacts");
      const manifesto = makeManifestoWithPatterns([
        { id: "artifact-spam", detector: "artifact-spam-rate > 10/day", penalty: 0.2 },
      ]);

      mockedReaddir.mockRejectedValueOnce(new Error("ENOENT"));

      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });
  });

  describe("self-promotion detection", () => {
    it("detects self-promotion when agent has too many self-positive signals", async () => {
      const agent = makeAgent("promoter");
      const manifesto = makeManifestoWithPatterns([
        { id: "self-promotion", detector: "self-reported-positive-signals > 3/week", penalty: 0.3 },
      ]);

      // Mock readdir for artifact-spam (not used, but detectAntiPatterns only runs configured patterns)
      // The self-promotion detector reads a specific reputation file
      mockedReadFile.mockResolvedValueOnce(
        makeReputationMd(agent.did, [
          { source: agent.did, score: 0.9, timestamp: recentTimestamp(24) },
          { source: agent.did, score: 0.85, timestamp: recentTimestamp(48) },
          { source: agent.did, score: 0.95, timestamp: recentTimestamp(72) },
          { source: agent.did, score: 0.8, timestamp: recentTimestamp(96) },
        ]) as any
      );

      const detections = await detectAntiPatterns([agent], manifesto);

      expect(detections).toHaveLength(1);
      expect(detections[0].patternId).toBe("self-promotion");
      expect(detections[0].penalty).toBe(0.3);
      expect(detections[0].evidence).toContain("4 self-reported");
    });

    it("does not flag signals from other agents", async () => {
      const agent = makeAgent("honest");
      const manifesto = makeManifestoWithPatterns([
        { id: "self-promotion", detector: "self-reported-positive-signals > 3/week", penalty: 0.3 },
      ]);

      mockedReadFile.mockResolvedValueOnce(
        makeReputationMd(agent.did, [
          { source: "did:awp:other-agent-1", score: 0.9, timestamp: recentTimestamp(24) },
          { source: "did:awp:other-agent-2", score: 0.85, timestamp: recentTimestamp(48) },
          { source: "did:awp:other-agent-3", score: 0.95, timestamp: recentTimestamp(72) },
          { source: "did:awp:other-agent-4", score: 0.8, timestamp: recentTimestamp(96) },
        ]) as any
      );

      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });

    it("does not flag low-score self-signals", async () => {
      const agent = makeAgent("humble");
      const manifesto = makeManifestoWithPatterns([
        { id: "self-promotion", detector: "self-reported-positive-signals > 3/week", penalty: 0.3 },
      ]);

      // Self-signals with score <= 0.7 should not be flagged
      mockedReadFile.mockResolvedValueOnce(
        makeReputationMd(agent.did, [
          { source: agent.did, score: 0.5, timestamp: recentTimestamp(24) },
          { source: agent.did, score: 0.6, timestamp: recentTimestamp(48) },
          { source: agent.did, score: 0.7, timestamp: recentTimestamp(72) },
          { source: agent.did, score: 0.4, timestamp: recentTimestamp(96) },
        ]) as any
      );

      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });
  });

  describe("coalition-capture detection", () => {
    it("detects coalition capture when evaluator diversity is too low", async () => {
      const agent = makeAgent("captured");
      const manifesto = makeManifestoWithPatterns([
        { id: "coalition-capture", detector: "evaluator-diversity < 2", penalty: 0.4 },
      ]);

      // Contracts directory has 4 evaluated contracts, all by same delegator
      const contractFiles = ["c1.md", "c2.md", "c3.md", "c4.md"];
      mockedReaddir.mockResolvedValueOnce(contractFiles as any);

      for (const _ of contractFiles) {
        mockedReadFile.mockResolvedValueOnce(
          makeContractMd(agent.did, "did:awp:single-evaluator", "evaluated") as any
        );
      }

      const detections = await detectAntiPatterns([agent], manifesto);

      expect(detections).toHaveLength(1);
      expect(detections[0].patternId).toBe("coalition-capture");
      expect(detections[0].penalty).toBe(0.4);
      expect(detections[0].evidence).toContain("1 unique evaluator");
    });

    it("does not flag when evaluator diversity is sufficient", async () => {
      const agent = makeAgent("diverse");
      const manifesto = makeManifestoWithPatterns([
        { id: "coalition-capture", detector: "evaluator-diversity < 2", penalty: 0.4 },
      ]);

      const contractFiles = ["c1.md", "c2.md", "c3.md"];
      mockedReaddir.mockResolvedValueOnce(contractFiles as any);

      mockedReadFile.mockResolvedValueOnce(
        makeContractMd(agent.did, "did:awp:evaluator-1", "evaluated") as any
      );
      mockedReadFile.mockResolvedValueOnce(
        makeContractMd(agent.did, "did:awp:evaluator-2", "evaluated") as any
      );
      mockedReadFile.mockResolvedValueOnce(
        makeContractMd(agent.did, "did:awp:evaluator-3", "evaluated") as any
      );

      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });

    it("does not flag when there are too few contracts", async () => {
      const agent = makeAgent("new-agent");
      const manifesto = makeManifestoWithPatterns([
        { id: "coalition-capture", detector: "evaluator-diversity < 2", penalty: 0.4 },
      ]);

      // Only 2 contracts (threshold for flag is >= 3)
      const contractFiles = ["c1.md", "c2.md"];
      mockedReaddir.mockResolvedValueOnce(contractFiles as any);

      for (const _ of contractFiles) {
        mockedReadFile.mockResolvedValueOnce(
          makeContractMd(agent.did, "did:awp:single-evaluator", "evaluated") as any
        );
      }

      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });
  });

  describe("default patterns", () => {
    it("uses default patterns when manifesto has empty antiPatterns", async () => {
      const agent = makeAgent("default-test");
      const manifesto = makeManifestoWithPatterns([]);

      // Mock for artifact-spam detector (readdir on artifacts dir)
      mockedReaddir.mockResolvedValueOnce([] as any);
      // Mock for self-promotion detector (readFile on reputation file)
      mockedReadFile.mockRejectedValueOnce(new Error("ENOENT"));
      // Mock for coalition-capture detector (readdir on contracts dir)
      mockedReaddir.mockResolvedValueOnce([] as any);

      // Should not throw — uses all 3 default detectors
      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });
  });

  describe("multi-agent detection", () => {
    it("runs detectors for each agent independently", async () => {
      const agent1 = makeAgent("agent-1", "/tmp/ws1");
      const agent2 = makeAgent("agent-2", "/tmp/ws2");
      const manifesto = makeManifestoWithPatterns([
        { id: "artifact-spam", detector: "artifact-spam-rate > 10/day", penalty: 0.2 },
      ]);

      // Agent 1: 15 recent artifacts (spam)
      const files1 = Array.from({ length: 15 }, (_, i) => `artifact-${i}.md`);
      mockedReaddir.mockResolvedValueOnce(files1 as any);
      for (const _ of files1) {
        mockedReadFile.mockResolvedValueOnce(makeArtifactMd(recentTimestamp(2)) as any);
      }

      // Agent 2: 3 recent artifacts (ok)
      const files2 = Array.from({ length: 3 }, (_, i) => `artifact-${i}.md`);
      mockedReaddir.mockResolvedValueOnce(files2 as any);
      for (const _ of files2) {
        mockedReadFile.mockResolvedValueOnce(makeArtifactMd(recentTimestamp(2)) as any);
      }

      const detections = await detectAntiPatterns([agent1, agent2], manifesto);

      expect(detections).toHaveLength(1);
      expect(detections[0].agentId).toBe("agent-1");
    });
  });

  describe("unknown detectors", () => {
    it("skips unknown detector IDs gracefully", async () => {
      const agent = makeAgent("test");
      const manifesto = makeManifestoWithPatterns([
        { id: "unknown-pattern", detector: "some-unknown-detector", penalty: 0.5 },
      ]);

      const detections = await detectAntiPatterns([agent], manifesto);
      expect(detections).toHaveLength(0);
    });
  });

  describe("penalty override", () => {
    it("uses manifesto-configured penalty over default", async () => {
      const agent = makeAgent("spammer");
      const manifesto = makeManifestoWithPatterns([
        { id: "artifact-spam", detector: "artifact-spam-rate > 10/day", penalty: 0.9 },
      ]);

      const files = Array.from({ length: 15 }, (_, i) => `artifact-${i}.md`);
      mockedReaddir.mockResolvedValueOnce(files as any);
      for (const _ of files) {
        mockedReadFile.mockResolvedValueOnce(makeArtifactMd(recentTimestamp(2)) as any);
      }

      const detections = await detectAntiPatterns([agent], manifesto);

      expect(detections).toHaveLength(1);
      // Should use manifesto penalty (0.9) not default (0.2)
      expect(detections[0].penalty).toBe(0.9);
    });
  });
});
