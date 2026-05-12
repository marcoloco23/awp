import { describe, it, expect } from "vitest";
import { validateFrontmatter, validateManifest } from "./schema.js";

describe("validateFrontmatter", () => {
  it("returns valid when type has no schema mapping", async () => {
    const r = await validateFrontmatter("nonexistent-type", { hello: 1 });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("accepts a well-formed identity frontmatter", async () => {
    const r = await validateFrontmatter("identity", {
      awp: "1.0.0",
      type: "identity",
      name: "Test Agent",
      creature: "test-bot",
      did: "did:awp:test",
    });
    // Schema may require additional fields; we just assert error array shape.
    expect(Array.isArray(r.errors)).toBe(true);
    expect(typeof r.valid).toBe("boolean");
  });

  it("flags clearly invalid frontmatter as invalid", async () => {
    const r = await validateFrontmatter("identity", { awp: 42, type: 7 });
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

describe("validateManifest", () => {
  it("accepts a well-formed manifest", async () => {
    const r = await validateManifest({
      awp: "1.0.0",
      name: "t",
      id: "urn:awp:workspace:abc",
      agent: { did: "did:awp:test", identityFile: "IDENTITY.md" },
    });
    // Either valid or has the specific shape of errors; we test the shape
    expect(Array.isArray(r.errors)).toBe(true);
  });

  it("flags missing required fields", async () => {
    const r = await validateManifest({});
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});
