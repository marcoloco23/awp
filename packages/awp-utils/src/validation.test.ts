import { describe, it, expect } from "vitest";
import {
  VALID_TASK_STATUSES,
  VALID_PROJECT_STATUSES,
  VALID_PROVENANCE_ACTIONS,
  VALID_PRIORITIES,
  normalizeTaskStatus,
  normalizeProvenanceAction,
  suggestValidValue,
  validateSlug,
  sanitizeSlug,
  validatePath,
  isValidDate,
  isValidTimestamp,
} from "./validation.js";

describe("constants", () => {
  it("exposes the four constant arrays", () => {
    expect(VALID_TASK_STATUSES).toContain("pending");
    expect(VALID_PROJECT_STATUSES).toContain("active");
    expect(VALID_PROVENANCE_ACTIONS).toContain("created");
    expect(VALID_PRIORITIES).toContain("low");
  });
});

describe("normalizeTaskStatus", () => {
  it("returns canonical for direct match", () => {
    expect(normalizeTaskStatus("pending")).toBe("pending");
    expect(normalizeTaskStatus("in-progress")).toBe("in-progress");
  });
  it("maps known aliases", () => {
    expect(normalizeTaskStatus("in_progress")).toBe("in-progress");
    expect(normalizeTaskStatus("WIP")).toBe("in-progress");
    expect(normalizeTaskStatus("done")).toBe("completed");
    expect(normalizeTaskStatus("in progress")).toBe("in-progress");
  });
  it("returns null for unrecognized input", () => {
    expect(normalizeTaskStatus("garbage")).toBeNull();
  });
});

describe("normalizeProvenanceAction", () => {
  it("returns canonical for direct match", () => {
    expect(normalizeProvenanceAction("created")).toBe("created");
  });
  it("maps known aliases", () => {
    expect(normalizeProvenanceAction("drafted")).toBe("created");
    expect(normalizeProvenanceAction("edit")).toBe("updated");
  });
  it("returns null for unrecognized input", () => {
    expect(normalizeProvenanceAction("zzz")).toBeNull();
  });
});

describe("suggestValidValue", () => {
  it("suggests hyphenated form for underscore input", () => {
    const out = suggestValidValue("in_progress", VALID_TASK_STATUSES);
    expect(out.suggestion).toBe("in-progress");
  });
  it("suggests close Levenshtein match", () => {
    const out = suggestValidValue("compeleted", VALID_TASK_STATUSES);
    expect(out.suggestion).toBe("completed");
  });
  it("returns null suggestion when nothing matches", () => {
    const out = suggestValidValue("xxxxxxxxx", VALID_TASK_STATUSES);
    expect(out.suggestion).toBeNull();
    expect(out.message).toContain("Valid values");
  });
});

describe("validateSlug", () => {
  it("accepts valid lowercase slugs", () => {
    expect(validateSlug("my-artifact")).toBe(true);
    expect(validateSlug("a1")).toBe(true);
    expect(validateSlug("a")).toBe(true);
  });
  it("rejects uppercase, underscores, leading hyphens, spaces", () => {
    expect(validateSlug("My-Slug")).toBe(false);
    expect(validateSlug("my_slug")).toBe(false);
    expect(validateSlug("-bad")).toBe(false);
    expect(validateSlug("a b")).toBe(false);
  });
  it("rejects slug over 100 chars", () => {
    expect(validateSlug("a".repeat(101))).toBe(false);
  });
});

describe("sanitizeSlug", () => {
  it("lowercases and trims valid slugs", () => {
    expect(sanitizeSlug(" My-Slug ")).toBe("my-slug");
  });
  it("throws on invalid characters", () => {
    expect(() => sanitizeSlug("bad_one")).toThrow(/Invalid slug/);
  });
  it("throws on slug over 100 chars", () => {
    // The function checks pattern first; for 101 a's pattern matches so length check triggers.
    expect(() => sanitizeSlug("a".repeat(101))).toThrow(/too long/);
  });
});

describe("validatePath", () => {
  it("returns absolute path within root", () => {
    const out = validatePath("/tmp/work", "a/b.txt");
    expect(out).toContain("/tmp/work");
    expect(out.endsWith("a/b.txt")).toBe(true);
  });
  it("throws on .. traversal", () => {
    expect(() => validatePath("/tmp/work", "../outside")).toThrow(/Path traversal/);
  });
  it("throws on absolute path outside root", () => {
    expect(() => validatePath("/tmp/work", "/etc/passwd")).toThrow(/Path traversal/);
  });
});

describe("isValidDate", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(isValidDate("2026-05-12")).toBe(true);
  });
  it("rejects malformed dates", () => {
    expect(isValidDate("2026/05/12")).toBe(false);
    expect(isValidDate("not-a-date")).toBe(false);
    expect(isValidDate("2026-13-99")).toBe(false);
  });
});

describe("isValidTimestamp", () => {
  it("accepts ISO timestamps", () => {
    expect(isValidTimestamp("2026-05-12T10:00:00.000Z")).toBe(true);
  });
  it("rejects garbage", () => {
    expect(isValidTimestamp("totally not a date")).toBe(false);
  });
});
