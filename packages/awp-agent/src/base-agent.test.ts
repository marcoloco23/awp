import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { BaseAgent } from "./base-agent.js";
import type { AgentTask, TaskResult } from "./types.js";

class FakeAgent extends BaseAgent {
  async executeTask(_task: AgentTask): Promise<TaskResult> {
    return {
      success: true,
      toolCalls: [],
      tokens: { input: 1, output: 1 },
      durationMs: 1,
    };
  }
  /** Exposed for testing. */
  async testBuildSystemPrompt(task: AgentTask): Promise<string> {
    // Use bracket access to bypass protected modifier in tests.
    const self = this as unknown as { buildSystemPrompt: (t: AgentTask) => Promise<string> };
    return self.buildSystemPrompt(task);
  }
}

async function makeWorkspace(agentDid = "did:awp:test"): Promise<string> {
  const dir = join(tmpdir(), `awp-base-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "t",
      id: "urn:awp:workspace:t",
      agent: { did: agentDid, identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("You are a test agent.", {
      awp: "1.0.0",
      type: "identity",
      name: "Test Bot",
      did: agentDid,
      role: "researcher",
    }),
  );
  await writeFile(
    join(dir, "SOUL.md"),
    matter.stringify("Be accurate.", { awp: "1.0.0", type: "soul" }),
  );
  return dir;
}

let ws: string;
beforeEach(async () => {
  ws = await makeWorkspace();
});
afterEach(async () => {
  await rm(ws, { recursive: true, force: true });
});

describe("BaseAgent.getIdentity", () => {
  it("returns name + did from manifest + IDENTITY.md", async () => {
    const a = new FakeAgent("agent-a", ws);
    const id = await a.getIdentity();
    expect(id.did).toBe("did:awp:test");
    expect(id.name).toBe("Test Bot");
    expect(id.role).toBe("researcher");
  });

  it("falls back to agent id when IDENTITY.md missing", async () => {
    await rm(join(ws, "IDENTITY.md"));
    const a = new FakeAgent("agent-a", ws);
    const id = await a.getIdentity();
    expect(id.name).toBe("agent-a");
  });
});

describe("BaseAgent.did getter", () => {
  it("throws before getIdentity() is called", () => {
    const a = new FakeAgent("agent-a", ws);
    expect(() => a.did).toThrow(/not initialized/);
  });
  it("returns did after getIdentity() is called", async () => {
    const a = new FakeAgent("agent-a", ws);
    await a.getIdentity();
    expect(a.did).toBe("did:awp:test");
  });
});

describe("BaseAgent.getReputation", () => {
  it("returns default 0.5 reputation when no reputation files exist", async () => {
    const a = new FakeAgent("agent-a", ws);
    const r = await a.getReputation();
    expect(r.overallScore).toBe(0.5);
    expect(r.dimensions.reliability.score).toBe(0.5);
  });

  it("returns parsed dimensions when a matching reputation profile exists", async () => {
    await mkdir(join(ws, "reputation"), { recursive: true });
    const now = new Date().toISOString();
    await writeFile(
      join(ws, "reputation", "self.md"),
      matter.stringify("\n# Profile\n", {
        awp: "1.0.0",
        rdp: "1.0.0",
        type: "reputation-profile",
        id: "reputation:self",
        agentDid: "did:awp:test",
        agentName: "Test Bot",
        lastUpdated: now,
        dimensions: {
          reliability: { score: 0.9, confidence: 0.5, sampleSize: 10, lastSignal: now },
        },
        signals: [],
      }),
    );
    const a = new FakeAgent("agent-a", ws);
    const r = await a.getReputation();
    expect(r.agentName).toBe("Test Bot");
    expect(r.dimensions.reliability.score).toBeGreaterThan(0.85);
  });
});

describe("BaseAgent.buildSystemPrompt", () => {
  it("includes identity + soul + task contractId", async () => {
    const a = new FakeAgent("agent-a", ws);
    const prompt = await a.testBuildSystemPrompt({
      contractId: "contract:research",
      description: "do thing",
    } as AgentTask);
    expect(prompt).toContain("test agent");
    expect(prompt).toContain("Be accurate");
    expect(prompt).toContain("contract:research");
  });

  it("includes manifesto values when manifesto provided", async () => {
    const a = new FakeAgent("agent-a", ws, {
      id: "manifesto:test",
      name: "Test Manifesto",
      version: "1.0.0",
      values: { "fidelity-to-reality": 0.5 },
      purity: { "epistemic-hygiene": 0.4, reliability: 0.3, coordination: 0.3 },
    } as never);
    const prompt = await a.testBuildSystemPrompt({
      contractId: "contract:x",
      description: "do",
    } as AgentTask);
    expect(prompt).toContain("Test Manifesto");
    expect(prompt).toContain("epistemic-hygiene");
  });
});
