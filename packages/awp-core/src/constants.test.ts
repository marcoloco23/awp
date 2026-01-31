import { describe, it, expect } from "vitest";
import {
  AWP_VERSION,
  SMP_VERSION,
  RDP_VERSION,
  REQUIRED_FILES,
  OPTIONAL_FILES,
  ALL_WORKSPACE_FILES,
  MANIFEST_PATH,
  MEMORY_DIR,
  ARTIFACTS_DIR,
  REPUTATION_DIR,
  CONTRACTS_DIR,
  FILE_TYPE_MAP,
  SCHEMA_MAP,
  getSchemaPath,
} from "./constants.js";

describe("AWP constants", () => {
  describe("version constants", () => {
    it("has valid semver AWP version", () => {
      expect(AWP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("has valid SMP version", () => {
      expect(SMP_VERSION).toMatch(/^\d+\.\d+$/);
    });

    it("has valid RDP version", () => {
      expect(RDP_VERSION).toMatch(/^\d+\.\d+$/);
    });
  });

  describe("file constants", () => {
    it("has required files", () => {
      expect(REQUIRED_FILES).toContain("IDENTITY.md");
      expect(REQUIRED_FILES).toContain("SOUL.md");
      expect(REQUIRED_FILES).toHaveLength(2);
    });

    it("has optional files", () => {
      expect(OPTIONAL_FILES).toContain("AGENTS.md");
      expect(OPTIONAL_FILES).toContain("USER.md");
      expect(OPTIONAL_FILES).toContain("MEMORY.md");
    });

    it("ALL_WORKSPACE_FILES combines required and optional", () => {
      expect(ALL_WORKSPACE_FILES).toHaveLength(REQUIRED_FILES.length + OPTIONAL_FILES.length);
      for (const file of REQUIRED_FILES) {
        expect(ALL_WORKSPACE_FILES).toContain(file);
      }
      for (const file of OPTIONAL_FILES) {
        expect(ALL_WORKSPACE_FILES).toContain(file);
      }
    });
  });

  describe("path constants", () => {
    it("has expected manifest path", () => {
      expect(MANIFEST_PATH).toBe(".awp/workspace.json");
    });

    it("has expected directory paths", () => {
      expect(MEMORY_DIR).toBe("memory");
      expect(ARTIFACTS_DIR).toBe("artifacts");
      expect(REPUTATION_DIR).toBe("reputation");
      expect(CONTRACTS_DIR).toBe("contracts");
    });
  });

  describe("FILE_TYPE_MAP", () => {
    it("maps identity type to IDENTITY.md", () => {
      expect(FILE_TYPE_MAP["identity"]).toBe("IDENTITY.md");
    });

    it("maps soul type to SOUL.md", () => {
      expect(FILE_TYPE_MAP["soul"]).toBe("SOUL.md");
    });

    it("maps operations type to AGENTS.md", () => {
      expect(FILE_TYPE_MAP["operations"]).toBe("AGENTS.md");
    });
  });

  describe("SCHEMA_MAP", () => {
    it("maps type names to schema files", () => {
      expect(SCHEMA_MAP["identity"]).toBe("identity.schema.json");
      expect(SCHEMA_MAP["soul"]).toBe("soul.schema.json");
      expect(SCHEMA_MAP["knowledge-artifact"]).toBe("knowledge-artifact.schema.json");
    });
  });

  describe("getSchemaPath", () => {
    it("returns absolute path to schema file", () => {
      const path = getSchemaPath("identity.schema.json");
      expect(path).toContain("schemas");
      expect(path).toContain("identity.schema.json");
    });
  });
});
