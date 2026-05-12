import { describe, it, expect } from "vitest";
import * as core from "./index.js";

describe("@agent-workspace/core public API", () => {
  it("exports protocol version constants", () => {
    expect(typeof core.AWP_VERSION).toBe("string");
    expect(typeof core.SMP_VERSION).toBe("string");
    expect(typeof core.RDP_VERSION).toBe("string");
    expect(typeof core.CDP_VERSION).toBe("string");
  });

  it("exports directory and file constants", () => {
    expect(core.MANIFEST_PATH).toContain("workspace.json");
    expect(core.MEMORY_DIR).toBe("memory");
    expect(core.ARTIFACTS_DIR).toBe("artifacts");
    expect(core.REPUTATION_DIR).toBe("reputation");
    expect(core.CONTRACTS_DIR).toBe("contracts");
    expect(core.PROJECTS_DIR).toBe("projects");
    expect(core.SWARMS_DIR).toBe("swarms");
  });

  it("exports sync constants", () => {
    expect(typeof core.SYNC_DIR).toBe("string");
    expect(typeof core.SYNC_REMOTES_FILE).toBe("string");
    expect(typeof core.SYNC_STATE_DIR).toBe("string");
    expect(typeof core.SYNC_CONFLICTS_DIR).toBe("string");
  });

  it("exports REQUIRED_FILES, OPTIONAL_FILES, ALL_WORKSPACE_FILES", () => {
    expect(Array.isArray(core.REQUIRED_FILES)).toBe(true);
    expect(core.REQUIRED_FILES.length).toBeGreaterThan(0);
    expect(Array.isArray(core.OPTIONAL_FILES)).toBe(true);
    expect(core.ALL_WORKSPACE_FILES.length).toBe(
      core.REQUIRED_FILES.length + core.OPTIONAL_FILES.length,
    );
  });

  it("exports schema mapping helpers", () => {
    expect(typeof core.FILE_TYPE_MAP).toBe("object");
    expect(typeof core.SCHEMA_MAP).toBe("object");
    expect(typeof core.SCHEMAS_DIR).toBe("string");
    expect(typeof core.getSchemaPath).toBe("function");
  });

  it("getSchemaPath joins SCHEMAS_DIR with a file name", () => {
    const p = core.getSchemaPath("identity.schema.json");
    expect(p.endsWith("identity.schema.json")).toBe(true);
    expect(p.startsWith(core.SCHEMAS_DIR)).toBe(true);
  });

  it("exports reputation tuning constants", () => {
    expect(typeof core.REPUTATION_EWMA_ALPHA).toBe("number");
    expect(typeof core.REPUTATION_DECAY_RATE).toBe("number");
    expect(typeof core.REPUTATION_BASELINE).toBe("number");
    expect(typeof core.MS_PER_MONTH).toBe("number");
    expect(core.REPUTATION_BASELINE).toBeGreaterThan(0);
    expect(core.REPUTATION_BASELINE).toBeLessThan(1);
  });
});
