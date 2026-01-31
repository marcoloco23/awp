import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { validatePath, sanitizeSlug, safeReadFile } from "@agent-workspace/utils";

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Create a temporary workspace directory for testing.
 */
async function createTestWorkspace(): Promise<string> {
  const testDir = join(tmpdir(), `awp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(testDir, { recursive: true });
  return testDir;
}

/**
 * Create a minimal AWP workspace structure.
 */
async function setupMinimalWorkspace(root: string): Promise<void> {
  // Create .awp directory and manifest
  await mkdir(join(root, ".awp"), { recursive: true });
  await writeFile(
    join(root, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "test-workspace",
      id: "urn:awp:workspace:test123",
      agent: {
        did: "did:awp:test-agent",
        identityFile: "IDENTITY.md",
      },
    })
  );

  // Create identity file
  const identityContent = matter.stringify("\n# Test Agent\n\nA test agent for unit tests.\n", {
    awp: "1.0.0",
    type: "identity",
    name: "Test Agent",
    creature: "test-bot",
    did: "did:awp:test-agent",
  });
  await writeFile(join(root, "IDENTITY.md"), identityContent);

  // Create soul file
  const soulContent = matter.stringify("\n# Soul\n\nCore values and boundaries.\n", {
    awp: "1.0.0",
    type: "soul",
    values: ["accuracy", "helpfulness"],
  });
  await writeFile(join(root, "SOUL.md"), soulContent);

  // Create user file
  const userContent = matter.stringify("\n# User Profile\n\nThe human user.\n", {
    awp: "1.0.0",
    type: "user",
    name: "Test User",
  });
  await writeFile(join(root, "USER.md"), userContent);
}

/**
 * Clean up test workspace.
 */
async function cleanupTestWorkspace(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

// =============================================================================
// Unit Tests: Security Utilities
// =============================================================================

describe("security utilities", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  describe("validatePath", () => {
    it("allows paths within workspace root", () => {
      const result = validatePath(testRoot, "subdir/file.txt");
      expect(result).toBe(join(testRoot, "subdir/file.txt"));
    });

    it("allows absolute paths within workspace root", () => {
      const result = validatePath(testRoot, join(testRoot, "subdir/file.txt"));
      expect(result).toBe(join(testRoot, "subdir/file.txt"));
    });

    it("throws on directory traversal with ..", () => {
      expect(() => validatePath(testRoot, "../outside.txt")).toThrow("Path traversal detected");
    });

    it("throws on nested directory traversal", () => {
      expect(() => validatePath(testRoot, "subdir/../../outside.txt")).toThrow(
        "Path traversal detected"
      );
    });

    it("throws on absolute paths outside workspace", () => {
      expect(() => validatePath(testRoot, "/etc/passwd")).toThrow("Path traversal detected");
    });

    it("normalizes paths with redundant segments", () => {
      const result = validatePath(testRoot, "./subdir/../subdir/file.txt");
      expect(result).toBe(join(testRoot, "subdir/file.txt"));
    });
  });

  describe("sanitizeSlug", () => {
    it("accepts valid lowercase alphanumeric slugs", () => {
      expect(sanitizeSlug("my-artifact")).toBe("my-artifact");
      expect(sanitizeSlug("test123")).toBe("test123");
      expect(sanitizeSlug("a")).toBe("a");
    });

    it("converts uppercase to lowercase", () => {
      expect(sanitizeSlug("My-Artifact")).toBe("my-artifact");
      expect(sanitizeSlug("TEST")).toBe("test");
    });

    it("trims whitespace", () => {
      expect(sanitizeSlug("  my-slug  ")).toBe("my-slug");
    });

    it("rejects slugs starting with hyphen", () => {
      expect(() => sanitizeSlug("-invalid")).toThrow("Invalid slug");
    });

    it("rejects slugs with invalid characters", () => {
      expect(() => sanitizeSlug("my_slug")).toThrow("Invalid slug");
      expect(() => sanitizeSlug("my.slug")).toThrow("Invalid slug");
      expect(() => sanitizeSlug("my slug")).toThrow("Invalid slug");
      expect(() => sanitizeSlug("my/slug")).toThrow("Invalid slug");
    });

    it("rejects empty slugs", () => {
      expect(() => sanitizeSlug("")).toThrow("Invalid slug");
      expect(() => sanitizeSlug("   ")).toThrow("Invalid slug");
    });

    it("rejects slugs longer than 100 characters", () => {
      const longSlug = "a".repeat(101);
      expect(() => sanitizeSlug(longSlug)).toThrow("Slug too long");
    });

    it("accepts slugs exactly 100 characters", () => {
      const maxSlug = "a".repeat(100);
      expect(sanitizeSlug(maxSlug)).toBe(maxSlug);
    });
  });

  describe("safeReadFile", () => {
    it("reads files within size limit", async () => {
      const filePath = join(testRoot, "test.txt");
      const content = "Hello, World!";
      await writeFile(filePath, content);

      const result = await safeReadFile(filePath);
      expect(result).toBe(content);
    });

    it("throws for non-existent files", async () => {
      const filePath = join(testRoot, "nonexistent.txt");
      await expect(safeReadFile(filePath)).rejects.toThrow();
    });

    it("throws for files exceeding 1MB", async () => {
      const filePath = join(testRoot, "large.txt");
      // Create a file just over 1MB
      const largeContent = "x".repeat(1024 * 1024 + 1);
      await writeFile(filePath, largeContent);

      await expect(safeReadFile(filePath)).rejects.toThrow("File too large");
    });

    it("allows files exactly at 1MB limit", async () => {
      const filePath = join(testRoot, "exact.txt");
      const exactContent = "x".repeat(1024 * 1024);
      await writeFile(filePath, exactContent);

      const result = await safeReadFile(filePath);
      expect(result.length).toBe(1024 * 1024);
    });
  });
});

// =============================================================================
// Integration Tests: Tool Handlers
// =============================================================================

/**
 * Note: The MCP server uses process.env.AWP_WORKSPACE to determine the workspace root.
 * We use vi.stubEnv to set this for testing, then dynamically import the module
 * to pick up the new env value. However, since the server auto-connects on import,
 * we test the exported utilities and manually construct tool handler tests.
 *
 * For full integration tests, consider refactoring the server to export tool handlers
 * separately from the server initialization.
 */

describe("workspace file operations", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
    await setupMinimalWorkspace(testRoot);
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  describe("identity file", () => {
    it("exists with valid frontmatter", async () => {
      const content = await readFile(join(testRoot, "IDENTITY.md"), "utf-8");
      const { data } = matter(content);

      expect(data.type).toBe("identity");
      expect(data.name).toBe("Test Agent");
      expect(data.did).toBe("did:awp:test-agent");
    });
  });

  describe("soul file", () => {
    it("exists with valid frontmatter", async () => {
      const content = await readFile(join(testRoot, "SOUL.md"), "utf-8");
      const { data } = matter(content);

      expect(data.type).toBe("soul");
      expect(data.values).toContain("accuracy");
    });
  });

  describe("user file", () => {
    it("exists with valid frontmatter", async () => {
      const content = await readFile(join(testRoot, "USER.md"), "utf-8");
      const { data } = matter(content);

      expect(data.type).toBe("user");
      expect(data.name).toBe("Test User");
    });
  });

  describe("workspace manifest", () => {
    it("contains valid agent DID", async () => {
      const content = await readFile(join(testRoot, ".awp", "workspace.json"), "utf-8");
      const manifest = JSON.parse(content);

      expect(manifest.agent.did).toBe("did:awp:test-agent");
      expect(manifest.id).toMatch(/^urn:awp:workspace:/);
    });
  });
});

describe("memory operations", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
    await setupMinimalWorkspace(testRoot);
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  it("creates memory directory and daily log", async () => {
    const memoryDir = join(testRoot, "memory");
    await mkdir(memoryDir, { recursive: true });

    const date = new Date().toISOString().split("T")[0];
    const memoryContent = matter.stringify(`\n# ${date}\n\n- **10:00** — Test entry\n`, {
      awp: "1.0.0",
      type: "memory-daily",
      date,
      entries: [{ time: "10:00", content: "Test entry" }],
    });
    await writeFile(join(memoryDir, `${date}.md`), memoryContent);

    const content = await readFile(join(memoryDir, `${date}.md`), "utf-8");
    const { data } = matter(content);

    expect(data.type).toBe("memory-daily");
    expect(data.date).toBe(date);
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0].content).toBe("Test entry");
  });

  it("creates long-term memory file", async () => {
    const memoryContent = matter.stringify("\n# Long-term Memory\n\nPersistent knowledge.\n", {
      awp: "1.0.0",
      type: "memory-longterm",
      lastUpdated: new Date().toISOString(),
    });
    await writeFile(join(testRoot, "MEMORY.md"), memoryContent);

    const content = await readFile(join(testRoot, "MEMORY.md"), "utf-8");
    const { data } = matter(content);

    expect(data.type).toBe("memory-longterm");
  });
});

describe("artifact operations", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
    await setupMinimalWorkspace(testRoot);
    await mkdir(join(testRoot, "artifacts"), { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  it("creates artifact with valid frontmatter", async () => {
    const now = new Date().toISOString();
    const artifactContent = matter.stringify("\n# Test Artifact\n\nSome research content.\n", {
      awp: "1.0.0",
      smp: "1.0.0",
      type: "knowledge-artifact",
      id: "artifact:test-research",
      title: "Test Research",
      authors: ["did:awp:test-agent"],
      version: 1,
      confidence: 0.8,
      tags: ["research", "testing"],
      created: now,
      lastModified: now,
      modifiedBy: "did:awp:test-agent",
      provenance: [
        {
          agent: "did:awp:test-agent",
          action: "created",
          timestamp: now,
        },
      ],
    });
    await writeFile(join(testRoot, "artifacts", "test-research.md"), artifactContent);

    const content = await readFile(join(testRoot, "artifacts", "test-research.md"), "utf-8");
    const { data, content: body } = matter(content);

    expect(data.type).toBe("knowledge-artifact");
    expect(data.title).toBe("Test Research");
    expect(data.version).toBe(1);
    expect(data.confidence).toBe(0.8);
    expect(data.tags).toContain("research");
    expect(data.provenance).toHaveLength(1);
    expect(body).toContain("Some research content");
  });

  it("increments version on update", async () => {
    const now = new Date().toISOString();
    const v1 = matter.stringify("\nV1 content\n", {
      awp: "1.0.0",
      smp: "1.0.0",
      type: "knowledge-artifact",
      id: "artifact:versioned",
      title: "Versioned Artifact",
      authors: ["did:awp:test-agent"],
      version: 1,
      created: now,
      lastModified: now,
      modifiedBy: "did:awp:test-agent",
      provenance: [],
    });
    await writeFile(join(testRoot, "artifacts", "versioned.md"), v1);

    // Read and update
    const raw = await readFile(join(testRoot, "artifacts", "versioned.md"), "utf-8");
    const parsed = matter(raw);
    parsed.data.version = 2;
    parsed.data.lastModified = new Date().toISOString();
    parsed.content = "\nV2 content\n";
    parsed.data.provenance.push({
      agent: "did:awp:test-agent",
      action: "updated",
      timestamp: new Date().toISOString(),
    });

    await writeFile(
      join(testRoot, "artifacts", "versioned.md"),
      matter.stringify(parsed.content, parsed.data)
    );

    const updated = await readFile(join(testRoot, "artifacts", "versioned.md"), "utf-8");
    const { data } = matter(updated);

    expect(data.version).toBe(2);
    expect(data.provenance).toHaveLength(1);
  });
});

describe("reputation operations", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
    await setupMinimalWorkspace(testRoot);
    await mkdir(join(testRoot, "reputation"), { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  it("creates reputation profile with dimensions", async () => {
    const now = new Date().toISOString();
    const profile = matter.stringify(
      "\n# External Agent — Reputation Profile\n\nTracked since today.\n",
      {
        awp: "1.0.0",
        rdp: "1.0.0",
        type: "reputation-profile",
        id: "reputation:external-agent",
        agentDid: "did:awp:external-agent",
        agentName: "External Agent",
        lastUpdated: now,
        dimensions: {
          reliability: {
            score: 0.85,
            confidence: 0.5,
            sampleSize: 5,
            lastSignal: now,
          },
        },
        domainCompetence: {
          typescript: {
            score: 0.9,
            confidence: 0.6,
            sampleSize: 8,
            lastSignal: now,
          },
        },
        signals: [],
      }
    );
    await writeFile(join(testRoot, "reputation", "external-agent.md"), profile);

    const content = await readFile(join(testRoot, "reputation", "external-agent.md"), "utf-8");
    const { data } = matter(content);

    expect(data.type).toBe("reputation-profile");
    expect(data.dimensions.reliability.score).toBe(0.85);
    expect(data.domainCompetence.typescript.score).toBe(0.9);
  });

  it("applies EWMA to reputation signals", () => {
    const ALPHA = 0.15;
    const existingScore = 0.7;
    const newSignalScore = 0.9;

    // EWMA formula: new = α * signal + (1 - α) * existing
    const expected = ALPHA * newSignalScore + (1 - ALPHA) * existingScore;
    const result = Math.round(expected * 1000) / 1000;

    expect(result).toBe(0.73); // 0.15 * 0.9 + 0.85 * 0.7 = 0.135 + 0.595 = 0.73
  });

  it("calculates confidence from sample size", () => {
    // Confidence formula: 1 - 1 / (1 + sampleSize * 0.1)
    const calculateConfidence = (sampleSize: number) =>
      Math.round((1 - 1 / (1 + sampleSize * 0.1)) * 100) / 100;

    expect(calculateConfidence(1)).toBe(0.09); // 1 - 1/1.1 ≈ 0.09
    expect(calculateConfidence(5)).toBe(0.33); // 1 - 1/1.5 ≈ 0.33
    expect(calculateConfidence(10)).toBe(0.5); // 1 - 1/2 = 0.5
    expect(calculateConfidence(50)).toBe(0.83); // 1 - 1/6 ≈ 0.83
  });
});

describe("contract operations", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
    await setupMinimalWorkspace(testRoot);
    await mkdir(join(testRoot, "contracts"), { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  it("creates delegation contract with evaluation criteria", async () => {
    const now = new Date().toISOString();
    const contract = matter.stringify(
      "\n# research-task — Delegation Contract\n\nDelegated to external-agent: Research TypeScript patterns.\n",
      {
        awp: "1.0.0",
        rdp: "1.0.0",
        type: "delegation-contract",
        id: "contract:research-task",
        status: "active",
        delegator: "did:awp:test-agent",
        delegate: "did:awp:external-agent",
        delegateSlug: "external-agent",
        created: now,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        task: {
          description: "Research TypeScript patterns",
          outputFormat: "markdown",
          outputSlug: "typescript-patterns",
        },
        evaluation: {
          criteria: {
            completeness: 0.3,
            accuracy: 0.4,
            clarity: 0.2,
            timeliness: 0.1,
          },
          result: null,
        },
      }
    );
    await writeFile(join(testRoot, "contracts", "research-task.md"), contract);

    const content = await readFile(join(testRoot, "contracts", "research-task.md"), "utf-8");
    const { data } = matter(content);

    expect(data.type).toBe("delegation-contract");
    expect(data.status).toBe("active");
    expect(data.evaluation.criteria.accuracy).toBe(0.4);
    expect(data.task.description).toBe("Research TypeScript patterns");
  });

  it("calculates weighted evaluation score", () => {
    const criteria = {
      completeness: 0.3,
      accuracy: 0.4,
      clarity: 0.2,
      timeliness: 0.1,
    };
    const scores = {
      completeness: 0.9,
      accuracy: 0.85,
      clarity: 0.8,
      timeliness: 1.0,
    };

    let weightedScore = 0;
    for (const [name, weight] of Object.entries(criteria)) {
      weightedScore += weight * scores[name as keyof typeof scores];
    }
    weightedScore = Math.round(weightedScore * 1000) / 1000;

    // 0.3*0.9 + 0.4*0.85 + 0.2*0.8 + 0.1*1.0 = 0.27 + 0.34 + 0.16 + 0.1 = 0.87
    expect(weightedScore).toBe(0.87);
  });
});

describe("project operations", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
    await setupMinimalWorkspace(testRoot);
    await mkdir(join(testRoot, "projects"), { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  it("creates project with members", async () => {
    const now = new Date().toISOString();
    const project = matter.stringify("\n# Test Project\n\nA test coordination project.\n", {
      awp: "1.0.0",
      cdp: "1.0.0",
      type: "project",
      id: "project:test-project",
      title: "Test Project",
      status: "active",
      owner: "did:awp:test-agent",
      created: now,
      members: [
        { did: "did:awp:test-agent", role: "lead", slug: "self" },
        { did: "did:awp:external-agent", role: "contributor", slug: "external-agent" },
      ],
      taskCount: 0,
      completedCount: 0,
    });
    await writeFile(join(testRoot, "projects", "test-project.md"), project);

    const content = await readFile(join(testRoot, "projects", "test-project.md"), "utf-8");
    const { data } = matter(content);

    expect(data.type).toBe("project");
    expect(data.status).toBe("active");
    expect(data.members).toHaveLength(2);
    expect(data.members[0].role).toBe("lead");
  });

  it("creates task within project", async () => {
    // Create project directory and tasks subdirectory
    await mkdir(join(testRoot, "projects", "test-project", "tasks"), { recursive: true });

    const now = new Date().toISOString();
    const task = matter.stringify("\n# Implement Feature\n\nImplement the new feature.\n", {
      awp: "1.0.0",
      cdp: "1.0.0",
      type: "task",
      id: "task:test-project/implement-feature",
      projectId: "project:test-project",
      title: "Implement Feature",
      status: "pending",
      priority: "high",
      created: now,
      assignee: "did:awp:external-agent",
      assigneeSlug: "external-agent",
      blockedBy: [],
      blocks: [],
      lastModified: now,
      modifiedBy: "did:awp:test-agent",
    });
    await writeFile(
      join(testRoot, "projects", "test-project", "tasks", "implement-feature.md"),
      task
    );

    const content = await readFile(
      join(testRoot, "projects", "test-project", "tasks", "implement-feature.md"),
      "utf-8"
    );
    const { data } = matter(content);

    expect(data.type).toBe("task");
    expect(data.status).toBe("pending");
    expect(data.priority).toBe("high");
    expect(data.assigneeSlug).toBe("external-agent");
  });

  it("tracks task dependencies", async () => {
    await mkdir(join(testRoot, "projects", "test-project", "tasks"), { recursive: true });

    const now = new Date().toISOString();

    // Task A (no dependencies)
    const taskA = matter.stringify("\n# Task A\n", {
      awp: "1.0.0",
      cdp: "1.0.0",
      type: "task",
      id: "task:test-project/task-a",
      projectId: "project:test-project",
      title: "Task A",
      status: "completed",
      priority: "medium",
      created: now,
      blockedBy: [],
      blocks: ["task:test-project/task-b"],
      lastModified: now,
      modifiedBy: "did:awp:test-agent",
    });
    await writeFile(join(testRoot, "projects", "test-project", "tasks", "task-a.md"), taskA);

    // Task B (blocked by A)
    const taskB = matter.stringify("\n# Task B\n", {
      awp: "1.0.0",
      cdp: "1.0.0",
      type: "task",
      id: "task:test-project/task-b",
      projectId: "project:test-project",
      title: "Task B",
      status: "pending",
      priority: "medium",
      created: now,
      blockedBy: ["task:test-project/task-a"],
      blocks: [],
      lastModified: now,
      modifiedBy: "did:awp:test-agent",
    });
    await writeFile(join(testRoot, "projects", "test-project", "tasks", "task-b.md"), taskB);

    const contentB = await readFile(
      join(testRoot, "projects", "test-project", "tasks", "task-b.md"),
      "utf-8"
    );
    const { data: dataB } = matter(contentB);

    expect(dataB.blockedBy).toContain("task:test-project/task-a");
  });
});

describe("workspace status", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
    await setupMinimalWorkspace(testRoot);
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  it("detects missing required files", async () => {
    // Remove SOUL.md
    await rm(join(testRoot, "SOUL.md"));

    const warnings: string[] = [];
    const fileChecks = ["IDENTITY.md", "SOUL.md"];

    for (const f of fileChecks) {
      try {
        await readFile(join(testRoot, f), "utf-8");
      } catch {
        warnings.push(`${f} missing`);
      }
    }

    expect(warnings).toContain("SOUL.md missing");
    expect(warnings).not.toContain("IDENTITY.md missing");
  });

  it("detects past-deadline contracts", async () => {
    await mkdir(join(testRoot, "contracts"), { recursive: true });

    const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const contract = matter.stringify("\n# Expired Contract\n", {
      awp: "1.0.0",
      rdp: "1.0.0",
      type: "delegation-contract",
      id: "contract:expired",
      status: "active",
      deadline: pastDeadline,
      delegator: "did:awp:test-agent",
      delegate: "did:awp:external-agent",
      delegateSlug: "external-agent",
      created: pastDeadline,
      task: { description: "Expired task" },
      evaluation: { criteria: {}, result: null },
    });
    await writeFile(join(testRoot, "contracts", "expired.md"), contract);

    // Check for past deadline
    const content = await readFile(join(testRoot, "contracts", "expired.md"), "utf-8");
    const { data } = matter(content);

    const now = new Date();
    const isPastDeadline =
      data.deadline &&
      (data.status === "active" || data.status === "draft") &&
      new Date(data.deadline) < now;

    expect(isPastDeadline).toBe(true);
  });

  it("detects reputation decay warning", async () => {
    await mkdir(join(testRoot, "reputation"), { recursive: true });

    // Create a profile with old lastUpdated
    const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
    const profile = matter.stringify("\n# Stale Agent\n", {
      awp: "1.0.0",
      rdp: "1.0.0",
      type: "reputation-profile",
      id: "reputation:stale-agent",
      agentDid: "did:awp:stale-agent",
      agentName: "Stale Agent",
      lastUpdated: oldDate,
      dimensions: {},
      domainCompetence: {},
      signals: [],
    });
    await writeFile(join(testRoot, "reputation", "stale-agent.md"), profile);

    const content = await readFile(join(testRoot, "reputation", "stale-agent.md"), "utf-8");
    const { data } = matter(content);

    const now = new Date();
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const daysSince = Math.floor(
      (now.getTime() - new Date(data.lastUpdated).getTime()) / MS_PER_DAY
    );

    expect(daysSince).toBeGreaterThan(30);
  });
});

describe("artifact merge operations", () => {
  let testRoot: string;

  beforeEach(async () => {
    testRoot = await createTestWorkspace();
    await setupMinimalWorkspace(testRoot);
    await mkdir(join(testRoot, "artifacts"), { recursive: true });
  });

  afterEach(async () => {
    await cleanupTestWorkspace(testRoot);
  });

  it("performs additive merge", async () => {
    const now = new Date().toISOString();

    // Target artifact
    const target = matter.stringify("\n# Target Content\n\nOriginal content.\n", {
      awp: "1.0.0",
      smp: "1.0.0",
      type: "knowledge-artifact",
      id: "artifact:target",
      title: "Target",
      authors: ["did:awp:agent-a"],
      version: 1,
      tags: ["shared"],
      created: now,
      lastModified: now,
      modifiedBy: "did:awp:agent-a",
      provenance: [],
    });
    await writeFile(join(testRoot, "artifacts", "target.md"), target);

    // Source artifact
    const source = matter.stringify("\n# Source Content\n\nAdditional content.\n", {
      awp: "1.0.0",
      smp: "1.0.0",
      type: "knowledge-artifact",
      id: "artifact:source",
      title: "Source",
      authors: ["did:awp:agent-b"],
      version: 1,
      tags: ["unique-tag"],
      confidence: 0.7,
      created: now,
      lastModified: now,
      modifiedBy: "did:awp:agent-b",
      provenance: [],
    });
    await writeFile(join(testRoot, "artifacts", "source.md"), source);

    // Simulate additive merge
    const targetRaw = await readFile(join(testRoot, "artifacts", "target.md"), "utf-8");
    const sourceRaw = await readFile(join(testRoot, "artifacts", "source.md"), "utf-8");

    const targetParsed = matter(targetRaw);
    const sourceParsed = matter(sourceRaw);

    // Add source content
    const separator = `\n---\n*Merged from ${sourceParsed.data.id}*\n\n`;
    targetParsed.content += separator + sourceParsed.content.trim() + "\n";

    // Union authors
    for (const author of sourceParsed.data.authors || []) {
      if (!targetParsed.data.authors.includes(author)) {
        targetParsed.data.authors.push(author);
      }
    }

    // Union tags
    for (const tag of sourceParsed.data.tags || []) {
      if (!targetParsed.data.tags.includes(tag)) {
        targetParsed.data.tags.push(tag);
      }
    }

    // Bump version
    targetParsed.data.version = 2;

    await writeFile(
      join(testRoot, "artifacts", "target.md"),
      matter.stringify(targetParsed.content, targetParsed.data)
    );

    const merged = await readFile(join(testRoot, "artifacts", "target.md"), "utf-8");
    const { data, content } = matter(merged);

    expect(data.version).toBe(2);
    expect(data.authors).toContain("did:awp:agent-a");
    expect(data.authors).toContain("did:awp:agent-b");
    expect(data.tags).toContain("shared");
    expect(data.tags).toContain("unique-tag");
    expect(content).toContain("Original content");
    expect(content).toContain("Additional content");
  });
});
