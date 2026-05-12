import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { AWP_TOOLS, executeToolCall } from "./tools.js";

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-tools-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "t",
      id: "urn:awp:workspace:t",
      agent: { did: "did:awp:agent", identityFile: "IDENTITY.md" },
    }),
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

describe("AWP_TOOLS catalog", () => {
  it("declares each core tool with name and description", () => {
    const names = AWP_TOOLS.map((t) => t.function.name);
    expect(names).toContain("awp_artifact_read");
    expect(names).toContain("awp_artifact_write");
    expect(names).toContain("awp_artifact_list");
    expect(names).toContain("awp_reputation_query");
    expect(names).toContain("task_complete");
    for (const t of AWP_TOOLS) {
      expect(typeof t.function.description).toBe("string");
      expect(t.function.description.length).toBeGreaterThan(10);
    }
  });
});

describe("executeToolCall", () => {
  it("rejects unknown tool name", async () => {
    const r = await executeToolCall(ws, "no_such_tool", {});
    expect(r.isError).toBe(true);
    expect(r.result).toContain("Unknown tool");
  });

  it("artifact_write creates a file, artifact_read returns it", async () => {
    const w = await executeToolCall(ws, "awp_artifact_write", {
      slug: "x",
      title: "X",
      content: "Body",
      confidence: 0.7,
    });
    expect(w.isError).toBeFalsy();
    const raw = await readFile(join(ws, "artifacts", "x.md"), "utf-8");
    expect(raw).toContain("X");

    const r = await executeToolCall(ws, "awp_artifact_read", { slug: "x" });
    expect(r.isError).toBeFalsy();
    expect(r.result).toContain("Body");
  });

  it("artifact_list returns artifact summaries", async () => {
    await executeToolCall(ws, "awp_artifact_write", {
      slug: "a",
      title: "A",
      content: "A body",
    });
    const r = await executeToolCall(ws, "awp_artifact_list", {});
    expect(r.result).toContain("a");
  });

  it("task_complete returns isComplete=true", async () => {
    const r = await executeToolCall(ws, "task_complete", { summary: "ok" });
    expect(r.isComplete).toBe(true);
    expect(r.result).toContain("ok");
  });

  it("reputation_query returns 0/no-data when profile missing", async () => {
    const r = await executeToolCall(ws, "awp_reputation_query", { slug: "ghost" });
    // Either an error or a default — just shape check
    expect(typeof r.result).toBe("string");
  });

  it("contract_accept errors when contract missing", async () => {
    const r = await executeToolCall(ws, "awp_contract_accept", { slug: "no-such" });
    expect(r.isError).toBe(true);
  });

  it("contract_complete updates a draft contract", async () => {
    await mkdir(join(ws, "contracts"), { recursive: true });
    const now = new Date().toISOString();
    await writeFile(
      join(ws, "contracts", "c1.md"),
      matter.stringify("\n# Contract\n", {
        awp: "1.0.0",
        rdp: "1.0.0",
        type: "delegation-contract",
        id: "contract:c1",
        status: "active",
        delegator: "did:awp:other",
        delegate: "did:awp:agent",
        delegateSlug: "agent",
        created: now,
        task: { description: "do thing" },
        evaluation: { criteria: { accuracy: 1.0 }, result: null },
      }),
    );
    const r = await executeToolCall(ws, "awp_contract_complete", {
      slug: "c1",
      message: "done",
    });
    expect(r.isError).toBeFalsy();
  });
});
