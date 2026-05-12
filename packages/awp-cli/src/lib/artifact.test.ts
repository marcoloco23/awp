import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";
import { validateSlug, idFromSlug, slugFromId, slugToPath, loadArtifact, listArtifacts } from "./artifact.js";

describe("artifact utilities", () => {
  describe("validateSlug", () => {
    it("accepts valid lowercase alphanumeric slugs", () => {
      expect(validateSlug("my-artifact")).toBe(true);
      expect(validateSlug("artifact123")).toBe(true);
      expect(validateSlug("a")).toBe(true);
      expect(validateSlug("test-slug-name")).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(validateSlug("")).toBe(false);
      expect(validateSlug("MyArtifact")).toBe(false);
      expect(validateSlug("my_artifact")).toBe(false);
      expect(validateSlug("-starts-with-hyphen")).toBe(false);
      expect(validateSlug("has spaces")).toBe(false);
      expect(validateSlug("special!chars")).toBe(false);
    });
  });

  describe("idFromSlug", () => {
    it("converts slug to artifact ID", () => {
      expect(idFromSlug("my-artifact")).toBe("artifact:my-artifact");
      expect(idFromSlug("test")).toBe("artifact:test");
    });
  });

  describe("slugFromId", () => {
    it("extracts slug from artifact ID", () => {
      expect(slugFromId("artifact:my-artifact")).toBe("my-artifact");
      expect(slugFromId("artifact:test")).toBe("test");
    });

    it("handles IDs without prefix", () => {
      expect(slugFromId("plain-slug")).toBe("plain-slug");
    });
  });

  describe("slugToPath", () => {
    it("generates correct file path", () => {
      expect(slugToPath("/workspace", "my-artifact")).toBe("/workspace/artifacts/my-artifact.md");
    });
  });
});

describe("loadArtifact + listArtifacts (against a tmpdir workspace)", () => {
  let root: string;

  beforeEach(async () => {
    root = join(tmpdir(), `awp-cli-art-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(join(root, "artifacts"), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function buildArtifact(slug: string, version = 1): string {
    const now = new Date().toISOString();
    return matter.stringify(`\n# ${slug}\n`, {
      awp: "1.0.0",
      smp: "1.0.0",
      type: "knowledge-artifact",
      id: `artifact:${slug}`,
      title: slug,
      authors: ["did:awp:author"],
      version,
      created: now,
      lastModified: now,
      modifiedBy: "did:awp:author",
      provenance: [],
    });
  }

  it("loadArtifact returns parsed frontmatter + body", async () => {
    await writeFile(join(root, "artifacts", "a.md"), buildArtifact("a", 3));
    const a = await loadArtifact(root, "a");
    expect(a.frontmatter.id).toBe("artifact:a");
    expect(a.frontmatter.version).toBe(3);
  });

  it("loadArtifact throws for missing files", async () => {
    await expect(loadArtifact(root, "no-such")).rejects.toThrow();
  });

  it("listArtifacts returns empty array when artifacts dir missing", async () => {
    await rm(join(root, "artifacts"), { recursive: true });
    expect(await listArtifacts(root)).toEqual([]);
  });

  it("listArtifacts lists only type=knowledge-artifact files", async () => {
    await writeFile(join(root, "artifacts", "a.md"), buildArtifact("a"));
    await writeFile(join(root, "artifacts", "b.md"), buildArtifact("b"));
    await writeFile(
      join(root, "artifacts", "note.md"),
      matter.stringify("# Note\n", { awp: "1.0.0", type: "other" }),
    );
    await writeFile(join(root, "artifacts", "broken.md"), "not valid yaml ---\n");
    const list = await listArtifacts(root);
    expect(list.map((a) => a.frontmatter.id).sort()).toEqual(["artifact:a", "artifact:b"]);
  });
});
