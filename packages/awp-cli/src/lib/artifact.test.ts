import { describe, it, expect } from "vitest";
import { validateSlug, idFromSlug, slugFromId, slugToPath } from "./artifact.js";

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
