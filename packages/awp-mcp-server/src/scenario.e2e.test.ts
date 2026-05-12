/**
 * MCP protocol end-to-end scenario.
 *
 * Drives a complete agent workflow against the real built stdio server,
 * via the official @modelcontextprotocol/sdk client. Covers every tool
 * group in a realistic sequence and verifies behavior through both the
 * protocol response and the resulting on-disk state.
 *
 * This is the closest we get to "an actual hosted agent operating against
 * a real AWP workspace" without involving an LLM.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile, realpath } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, "..", "dist", "index.js");

beforeAll(() => {
  if (!existsSync(SERVER_PATH)) {
    throw new Error(
      `MCP server not built at ${SERVER_PATH}. Run \`npm run build --workspace=@agent-workspace/mcp-server\` first.`,
    );
  }
});

async function makeWorkspace(label: string): Promise<string> {
  const base = await realpath(tmpdir());
  const dir = join(base, `awp-scenario-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: `agent-${label}`,
      id: `urn:awp:workspace:${label}`,
      agent: { did: `did:awp:${label}`, identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("\nResearch agent.\n", {
      awp: "1.0.0",
      type: "identity",
      name: `Agent ${label}`,
      did: `did:awp:${label}`,
    }),
  );
  await writeFile(
    join(dir, "SOUL.md"),
    matter.stringify("\nValues.\n", {
      awp: "1.0.0",
      type: "soul",
      values: ["reliability", "epistemic-hygiene"],
    }),
  );
  await writeFile(
    join(dir, "USER.md"),
    matter.stringify("\nThe user.\n", { awp: "1.0.0", type: "user", name: "Human" }),
  );
  return dir;
}

async function connect(workspace: string): Promise<Client> {
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH],
    env: { ...process.env, AWP_WORKSPACE: workspace } as Record<string, string>,
    stderr: "pipe",
  });
  const client = new Client({ name: "scenario", version: "0.0.0" });
  await client.connect(transport);
  return client;
}

async function callJson<T = unknown>(client: Client, name: string, args: Record<string, unknown> = {}): Promise<T> {
  const out = await client.callTool({ name, arguments: args });
  if (out.isError) {
    const content = out.content as Array<{ text: string }>;
    throw new Error(`${name} error: ${content[0]?.text}`);
  }
  const content = out.content as Array<{ text: string }>;
  return JSON.parse(content[0]?.text ?? "null") as T;
}

async function callText(client: Client, name: string, args: Record<string, unknown> = {}): Promise<string> {
  const out = await client.callTool({ name, arguments: args });
  const content = out.content as Array<{ text: string }>;
  return content[0]?.text ?? "";
}

let ws: string;
let peer: string;

beforeEach(async () => {
  ws = await makeWorkspace("alpha");
  peer = await makeWorkspace("beta");
});

afterEach(async () => {
  await rm(ws, { recursive: true, force: true });
  await rm(peer, { recursive: true, force: true });
});

describe("MCP protocol end-to-end agent scenario", () => {
  it("runs a complete agent workflow through every tool group", async () => {
    const client = await connect(ws);
    try {
      // 1. Identity / soul / user
      const identity = await callJson<{ frontmatter: { name: string; did: string } }>(client, "awp_read_identity");
      expect(identity.frontmatter.name).toBe("Agent alpha");
      expect(identity.frontmatter.did).toBe("did:awp:alpha");

      const soul = await callJson<{ frontmatter: { values: string[] } }>(client, "awp_read_soul");
      expect(Array.isArray(soul.frontmatter.values)).toBe(true);

      const user = await callJson<{ frontmatter: { name: string } }>(client, "awp_read_user");
      expect(user.frontmatter.name).toBe("Human");

      // 2. Memory
      await client.callTool({
        name: "awp_write_memory",
        arguments: { content: "Starting research", tags: ["session-start"] },
      });
      const recent = await callText(client, "awp_read_memory", { target: "recent" });
      expect(recent).toContain("Starting research");

      // 3. Project + tasks with dependency
      await client.callTool({ name: "awp_project_create", arguments: { slug: "q3", title: "Q3" } });
      await client.callTool({
        name: "awp_task_create",
        arguments: { projectSlug: "q3", taskSlug: "research", title: "Research", priority: "high" },
      });
      await client.callTool({
        name: "awp_task_create",
        arguments: {
          projectSlug: "q3",
          taskSlug: "synthesize",
          title: "Synthesize",
          blockedBy: ["task:q3/research"],
        },
      });
      const tasks = await callJson<{ tasks: unknown[] }>(client, "awp_task_list", { projectSlug: "q3" });
      expect(tasks.tasks).toHaveLength(2);

      const graph = await callJson<{
        isValid: boolean;
        blocked: Record<string, string[]>;
      }>(client, "awp_task_graph", { projectSlug: "q3" });
      expect(graph.isValid).toBe(true);
      expect(graph.blocked.synthesize).toContain("research");

      // 4. Artifact write → read → update → search → version bump
      await client.callTool({
        name: "awp_artifact_write",
        arguments: {
          slug: "patterns",
          title: "Patterns",
          content: "Initial findings.",
          confidence: 0.65,
          tags: ["coordination"],
          message: "Initial.",
        },
      });
      const art1 = await callJson<{ frontmatter: { version: number; provenance: unknown[] } }>(client, "awp_artifact_read", { slug: "patterns" });
      expect(art1.frontmatter.version).toBe(1);
      expect(art1.frontmatter.provenance).toHaveLength(1);

      await client.callTool({
        name: "awp_artifact_write",
        arguments: {
          slug: "patterns",
          title: "Patterns",
          content: "Initial findings.\n\nUpdate: deeper review.",
          confidence: 0.78,
          message: "Updated.",
        },
      });
      const art2 = await callJson<{ frontmatter: { version: number; confidence: number; provenance: unknown[] } }>(client, "awp_artifact_read", { slug: "patterns" });
      expect(art2.frontmatter.version).toBe(2);
      expect(art2.frontmatter.confidence).toBe(0.78);
      expect(art2.frontmatter.provenance).toHaveLength(2);

      const search = await callJson<{ results: unknown[] }>(client, "awp_artifact_search", { query: "patterns" });
      expect(search.results.length).toBeGreaterThan(0);

      // 5. Task graph reacts to completion
      await client.callTool({
        name: "awp_task_update",
        arguments: { projectSlug: "q3", taskSlug: "research", status: "completed" },
      });
      const graphAfter = await callJson<{ blocked: Record<string, string[]> }>(client, "awp_task_graph", { projectSlug: "q3" });
      expect(Object.keys(graphAfter.blocked)).toHaveLength(0);

      // 6. Reputation signals
      await client.callTool({
        name: "awp_reputation_signal",
        arguments: {
          slug: "peer-beta",
          agentDid: "did:awp:beta",
          agentName: "Agent beta",
          dimension: "epistemic-hygiene",
          score: 0.85,
        },
      });
      await client.callTool({
        name: "awp_reputation_signal",
        arguments: { slug: "peer-beta", dimension: "reliability", score: 0.9 },
      });
      const rep = await callJson<{ dimensions: Record<string, { score: number }> }>(client, "awp_reputation_query", { slug: "peer-beta" });
      expect(rep.dimensions["epistemic-hygiene"].score).toBe(0.85);
      expect(rep.dimensions.reliability.score).toBe(0.9);

      // 7. Contract create + evaluate
      await client.callTool({
        name: "awp_contract_create",
        arguments: {
          slug: "synthesize-q3",
          delegate: "did:awp:beta",
          delegateSlug: "peer-beta",
          description: "Summarize findings.",
          criteria: { completeness: 0.4, accuracy: 0.4, clarity: 0.2 },
        },
      });
      const contractList = await callJson<Array<{ slug: string }>>(client, "awp_contract_list");
      expect(contractList.some((c) => c.slug === "synthesize-q3")).toBe(true);

      const evalText = await callText(client, "awp_contract_evaluate", {
        slug: "synthesize-q3",
        scores: { completeness: 0.9, accuracy: 0.85, clarity: 0.95 },
      });
      // 0.4*0.9 + 0.4*0.85 + 0.2*0.95 = 0.89
      expect(evalText).toContain("0.89");

      const betaRep = await callJson<{ signals?: Array<{ evidence?: string }> }>(client, "awp_reputation_query", { slug: "peer-beta" });
      expect(betaRep.signals?.some((s) => s.evidence === "contract:synthesize-q3")).toBe(true);

      // 8. Swarm: create + role-add + auto-recruit
      await client.callTool({ name: "awp_swarm_create", arguments: { slug: "pod", name: "Pod", goal: "Goals" } });
      await client.callTool({
        name: "awp_swarm_role_add",
        arguments: {
          slug: "pod",
          roleName: "reviewer",
          count: 1,
          minReputation: { reliability: 0.7 },
        },
      });
      const recruit = await callJson<{ recruited: boolean }>(client, "awp_swarm_recruit", { slug: "pod", auto: true });
      expect(recruit.recruited).toBe(true);

      const showSwarm = await callJson<{
        frontmatter: { status: string };
        roles: Array<{ assigned: string[] }>;
      }>(client, "awp_swarm_show", { slug: "pod" });
      expect(showSwarm.roles[0].assigned).toContain("did:awp:beta");
      expect(showSwarm.frontmatter.status).toBe("active");

      // 9. Aggregated workspace status reflects everything we created
      const status = await callJson<{
        manifest: { name: string };
        projects: { list: Array<{ slug: string }> };
        artifacts: { count: number };
        contracts: { count: number };
        reputation: { count: number };
        health: { ok: boolean };
      }>(client, "awp_workspace_status");
      expect(status.manifest.name).toBe("agent-alpha");
      expect(status.projects.list.some((p) => p.slug === "q3")).toBe(true);
      expect(status.artifacts.count).toBeGreaterThan(0);
      expect(status.contracts.count).toBeGreaterThan(0);
      expect(status.reputation.count).toBeGreaterThan(0);
      expect(status.health.ok).toBe(true);

      // 10. Federate: push artifact + signals to peer workspace
      await client.callTool({
        name: "awp_sync_remote_add",
        arguments: { name: "beta", url: peer, transport: "local-fs" },
      });
      const push = await callJson<{ imported: string[]; updated: string[] }>(client, "awp_sync_push", { remote: "beta" });
      expect(push.imported.length + push.updated.length).toBeGreaterThan(0);

      // Verify the peer received the version-2 artifact on disk
      const peerArt = await readFile(join(peer, "artifacts", "patterns.md"), "utf-8");
      const peerParsed = matter(peerArt);
      expect(peerParsed.data.version).toBe(2);
      expect(peerParsed.content).toContain("deeper review");

      // Push signals
      const sigPush = await callJson<{ pushed: number }>(client, "awp_sync_push_signals", { remote: "beta" });
      expect(typeof sigPush.pushed).toBe("number");
    } finally {
      await client.close();
    }

    // 11. The peer agent, in its own session, sees what alpha pushed
    const peerClient = await connect(peer);
    try {
      const peerArtList = await callJson<{ artifacts: Array<{ slug: string }> }>(peerClient, "awp_artifact_list");
      expect(peerArtList.artifacts.some((a) => a.slug === "patterns")).toBe(true);

      const peerReps = await callJson<{ profiles: Array<{ agentDid: string }> }>(peerClient, "awp_reputation_query");
      expect(peerReps.profiles.some((p) => p.agentDid === "did:awp:beta")).toBe(true);
    } finally {
      await peerClient.close();
    }
  }, 30_000);
});
