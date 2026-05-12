/**
 * Dashboard API route handler tests.
 *
 * The dashboard reads from AWP_WORKSPACE. Each test stubs that env var to a
 * temp workspace, then directly invokes the route handler with a mock Request.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";

import { GET as identityGET } from "@/app/api/identity/route";
import { GET as soulGET } from "@/app/api/soul/route";
import { GET as artifactsGET } from "@/app/api/artifacts/route";
import { GET as workspaceGET } from "@/app/api/workspace/route";
import { GET as memoryGET } from "@/app/api/memory/route";
import { GET as projectsGET } from "@/app/api/projects/route";
import { GET as reputationGET } from "@/app/api/reputation/route";
import { GET as contractsGET } from "@/app/api/contracts/route";

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-dash-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await mkdir(join(dir, "artifacts"), { recursive: true });
  await mkdir(join(dir, "memory"), { recursive: true });
  await mkdir(join(dir, "projects"), { recursive: true });
  await mkdir(join(dir, "reputation"), { recursive: true });
  await mkdir(join(dir, "contracts"), { recursive: true });

  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "dash-test",
      id: "urn:awp:workspace:dash",
      agent: { did: "did:awp:dash", identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("\n# Dash Identity\n", {
      awp: "1.0.0",
      type: "identity",
      name: "Dash Bot",
      did: "did:awp:dash",
    }),
  );
  await writeFile(
    join(dir, "SOUL.md"),
    matter.stringify("\n# Soul\n", { awp: "1.0.0", type: "soul", values: ["v"] }),
  );
  await writeFile(
    join(dir, "artifacts", "a1.md"),
    matter.stringify("\n# A1\n", {
      awp: "1.0.0",
      smp: "1.0.0",
      type: "knowledge-artifact",
      id: "artifact:a1",
      title: "A One",
      authors: ["did:awp:dash"],
      version: 1,
      tags: ["t1"],
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      modifiedBy: "did:awp:dash",
      provenance: [],
    }),
  );

  return dir;
}

let WS: string;
beforeEach(async () => {
  WS = await makeWorkspace();
  vi.stubEnv("AWP_WORKSPACE", WS);
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(WS, { recursive: true, force: true });
});

describe("dashboard API routes", () => {
  it("/api/identity returns the parsed identity", async () => {
    const res = await identityGET();
    const data = await res.json();
    expect(data.frontmatter.name).toBe("Dash Bot");
  });

  it("/api/soul returns the parsed soul", async () => {
    const res = await soulGET();
    const data = await res.json();
    expect(data.frontmatter.type).toBe("soul");
  });

  it("/api/artifacts lists artifacts", async () => {
    const res = await artifactsGET(new Request("http://test/api/artifacts"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data[0].slug).toBe("a1");
  });

  it("/api/artifacts?tag=t1 filters by tag", async () => {
    const res = await artifactsGET(new Request("http://test/api/artifacts?tag=t1"));
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
  });

  it("/api/artifacts?tag=missing returns empty list", async () => {
    const res = await artifactsGET(new Request("http://test/api/artifacts?tag=missing"));
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("/api/workspace returns manifest + health + stats", async () => {
    const res = await workspaceGET();
    const data = await res.json();
    expect(data.manifest.name).toBe("dash-test");
    expect(data.health).toBeDefined();
    expect(data.stats).toBeDefined();
  });

  it("/api/memory returns logs + longterm", async () => {
    const date = new Date().toISOString().split("T")[0];
    await writeFile(
      join(WS, "memory", `${date}.md`),
      matter.stringify("\n# Memory\n", {
        awp: "1.0.0",
        type: "memory-daily",
        date,
        entries: [{ time: "10:00", content: "test" }],
      }),
    );
    const res = await memoryGET(new Request("http://test/api/memory"));
    const data = await res.json();
    expect(data.logs).toBeDefined();
  });

  it("/api/projects returns project list", async () => {
    await writeFile(
      join(WS, "projects", "p1.md"),
      matter.stringify("\n# Project\n", {
        awp: "1.0.0",
        cdp: "1.0.0",
        type: "project",
        id: "project:p1",
        title: "P1",
        status: "active",
        owner: "did:awp:dash",
        created: new Date().toISOString(),
        members: [],
        taskCount: 0,
        completedCount: 0,
      }),
    );
    const res = await projectsGET(new Request("http://test/api/projects"));
    const data = await res.json();
    expect(data.length).toBeGreaterThan(0);
  });

  it("/api/reputation returns profile list", async () => {
    await writeFile(
      join(WS, "reputation", "ext.md"),
      matter.stringify("\n# Profile\n", {
        awp: "1.0.0",
        rdp: "1.0.0",
        type: "reputation-profile",
        id: "reputation:ext",
        agentDid: "did:awp:ext",
        agentName: "Ext",
        lastUpdated: new Date().toISOString(),
        dimensions: {},
        signals: [],
      }),
    );
    const res = await reputationGET();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("/api/contracts returns contracts list", async () => {
    await writeFile(
      join(WS, "contracts", "c1.md"),
      matter.stringify("\n# C1\n", {
        awp: "1.0.0",
        rdp: "1.0.0",
        type: "delegation-contract",
        id: "contract:c1",
        status: "active",
        delegator: "did:awp:dash",
        delegate: "did:awp:ext",
        delegateSlug: "ext",
        created: new Date().toISOString(),
        task: { description: "x" },
        evaluation: { criteria: {}, result: null },
      }),
    );
    const res = await contractsGET(new Request("http://test/api/contracts"));
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });
});
