/**
 * MCP server E2E — spawn the built stdio server and exercise it via the SDK
 * client. Validates: server boots, listTools returns all groups, and a
 * representative tool call succeeds against a temp workspace.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, realpath } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SERVER_PATH = resolve(__dirname, "..", "dist", "index.js");

let WS: string;

async function makeWorkspace(): Promise<string> {
  const base = await realpath(tmpdir());
  const dir = join(base, `awp-mcp-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "t",
      id: "urn:awp:workspace:t",
      agent: { did: "did:awp:test-agent", identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("\n# Identity\n", {
      awp: "1.0.0",
      type: "identity",
      name: "Test Agent",
      did: "did:awp:test-agent",
    }),
  );
  await writeFile(
    join(dir, "SOUL.md"),
    matter.stringify("\n# Soul\n", { awp: "1.0.0", type: "soul", values: ["x"] }),
  );
  await writeFile(
    join(dir, "USER.md"),
    matter.stringify("\n# User\n", { awp: "1.0.0", type: "user", name: "User" }),
  );
  return dir;
}

beforeAll(() => {
  if (!existsSync(SERVER_PATH)) {
    throw new Error(`MCP server not built at ${SERVER_PATH}. Run \`npm run build --workspace=@agent-workspace/mcp-server\` first.`);
  }
});

let client: Client;
let transport: StdioClientTransport;

beforeEach(async () => {
  WS = await makeWorkspace();
  transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH],
    env: { ...process.env, AWP_WORKSPACE: WS } as Record<string, string>,
    stderr: "pipe",
  });
  client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(transport);
});

afterEach(async () => {
  await client.close();
  await rm(WS, { recursive: true, force: true });
});

describe("MCP server E2E", () => {
  it("lists tools from every registered category", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    // Identity
    expect(names).toContain("awp_read_identity");
    expect(names).toContain("awp_read_soul");
    expect(names).toContain("awp_read_user");
    // Memory
    expect(names).toContain("awp_read_memory");
    expect(names).toContain("awp_write_memory");
    // Artifact
    expect(names).toContain("awp_artifact_read");
    expect(names).toContain("awp_artifact_write");
    // Status
    expect(names).toContain("awp_workspace_status");
    // Reputation
    expect(names).toContain("awp_reputation_query");
    expect(names).toContain("awp_reputation_signal");
    // Contract
    expect(names).toContain("awp_contract_create");
    // Project / Task
    expect(names).toContain("awp_project_create");
    expect(names).toContain("awp_task_create");
    // Swarm
    expect(names).toContain("awp_swarm_create");
    // Sync
    expect(names).toContain("awp_sync_remote_add");
    // Config
    expect(names).toContain("awp_read_tools");
  });

  it("awp_read_identity returns the workspace identity", async () => {
    const out = await client.callTool({
      name: "awp_read_identity",
      arguments: {},
    });
    expect(out.isError).toBeFalsy();
    const content = out.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Test Agent");
  });

  it("awp_artifact_write + awp_artifact_read round-trip via the protocol", async () => {
    const w = await client.callTool({
      name: "awp_artifact_write",
      arguments: {
        slug: "e2e-art",
        title: "E2E Art",
        content: "Body via MCP.",
      },
    });
    expect(w.isError).toBeFalsy();

    const r = await client.callTool({
      name: "awp_artifact_read",
      arguments: { slug: "e2e-art" },
    });
    expect(r.isError).toBeFalsy();
    const content = r.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("E2E Art");
  });
});
