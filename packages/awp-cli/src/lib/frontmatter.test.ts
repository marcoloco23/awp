import { describe, it, expect } from "vitest";
import { hasAWPFrontmatter } from "./frontmatter.js";

describe("hasAWPFrontmatter", () => {
  it("true when both awp and type are strings", () => {
    expect(hasAWPFrontmatter({ awp: "1.0.0", type: "identity" })).toBe(true);
  });
  it("false when awp is missing", () => {
    expect(hasAWPFrontmatter({ type: "identity" })).toBe(false);
  });
  it("false when type is missing", () => {
    expect(hasAWPFrontmatter({ awp: "1.0.0" })).toBe(false);
  });
  it("false when fields are non-strings", () => {
    expect(hasAWPFrontmatter({ awp: 1, type: 2 })).toBe(false);
  });
  it("false for empty object", () => {
    expect(hasAWPFrontmatter({})).toBe(false);
  });
});
