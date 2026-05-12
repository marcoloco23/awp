import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseWorkspaceFile,
  serializeWorkspaceFile,
  writeWorkspaceFile,
  getFrontmatterType,
} from "./frontmatter.js";

interface TestFM {
  awp: string;
  type: string;
  title?: string;
  tags?: string[];
}

describe("parseWorkspaceFile", () => {
  let root: string;
  beforeEach(async () => {
    root = join(tmpdir(), `awp-fm-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(root, { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("parses frontmatter and body", async () => {
    const path = join(root, "doc.md");
    await writeFile(path, "---\nawp: \"1.0.0\"\ntype: identity\ntitle: Hello\n---\n\nBody text.\n");
    const file = await parseWorkspaceFile<TestFM>(path);
    expect(file.frontmatter.type).toBe("identity");
    expect(file.frontmatter.title).toBe("Hello");
    expect(file.body.trim()).toBe("Body text.");
    expect(file.filePath).toBe(path);
  });

  it("returns empty body when only frontmatter", async () => {
    const path = join(root, "only.md");
    await writeFile(path, "---\nawp: \"1.0.0\"\ntype: x\n---\n");
    const file = await parseWorkspaceFile<TestFM>(path);
    expect(file.body.trim()).toBe("");
  });

  it("returns empty frontmatter when only body", async () => {
    const path = join(root, "body.md");
    await writeFile(path, "# Just a heading\n\nNo frontmatter here.\n");
    const file = await parseWorkspaceFile<TestFM>(path);
    expect(file.body).toContain("Just a heading");
    expect(file.frontmatter as unknown).toEqual({});
  });

  it("preserves unicode in body", async () => {
    const path = join(root, "uni.md");
    const body = "日本語テスト · café · 🚀\n";
    await writeFile(path, `---\nawp: "1.0.0"\ntype: x\n---\n\n${body}`);
    const file = await parseWorkspaceFile<TestFM>(path);
    expect(file.body).toContain("日本語");
    expect(file.body).toContain("🚀");
  });

  it("throws when file does not exist", async () => {
    await expect(parseWorkspaceFile(join(root, "missing.md"))).rejects.toThrow();
  });
});

describe("serializeWorkspaceFile", () => {
  it("round-trips parse → serialize → parse", async () => {
    const path = "x";
    const file = {
      frontmatter: { awp: "1.0.0", type: "test", tags: ["a", "b"] } as TestFM,
      body: "Hello.\n",
      filePath: path,
    };
    const out = serializeWorkspaceFile(file);
    expect(out).toContain("type: test");
    expect(out).toContain("Hello.");
    expect(out.startsWith("---")).toBe(true);
  });
});

describe("writeWorkspaceFile", () => {
  let root: string;
  beforeEach(async () => {
    root = join(tmpdir(), `awp-fmw-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(root, { recursive: true });
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes a file that can be re-read", async () => {
    const path = join(root, "out.md");
    await writeWorkspaceFile<TestFM>({
      frontmatter: { awp: "1.0.0", type: "identity", title: "T" },
      body: "B\n",
      filePath: path,
    });
    const reread = await parseWorkspaceFile<TestFM>(path);
    expect(reread.frontmatter.type).toBe("identity");
    expect(reread.frontmatter.title).toBe("T");
    expect(reread.body.trim()).toBe("B");
  });
});

describe("getFrontmatterType", () => {
  it("returns the type when present and string", () => {
    expect(getFrontmatterType({ type: "identity" })).toBe("identity");
  });
  it("returns undefined when absent", () => {
    expect(getFrontmatterType({})).toBeUndefined();
  });
  it("returns undefined when not a string", () => {
    expect(getFrontmatterType({ type: 42 })).toBeUndefined();
    expect(getFrontmatterType({ type: null })).toBeUndefined();
  });
});
