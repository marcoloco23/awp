import { describe, it, expect } from "vitest";
import { generateWorkspaceId, createDefaultManifest } from "./workspace.js";
import { AWP_VERSION } from "@agent-workspace/core";

describe("workspace utilities", () => {
  describe("generateWorkspaceId", () => {
    it("generates a valid URN format", () => {
      const id = generateWorkspaceId();
      expect(id).toMatch(/^urn:awp:workspace:[a-f0-9]{16}$/);
    });

    it("generates unique IDs", () => {
      const id1 = generateWorkspaceId();
      const id2 = generateWorkspaceId();
      expect(id1).not.toBe(id2);
    });
  });

  describe("createDefaultManifest", () => {
    it("creates a manifest with required fields", () => {
      const manifest = createDefaultManifest("test-workspace");

      expect(manifest.awp).toBe(AWP_VERSION);
      expect(manifest.name).toBe("test-workspace");
      expect(manifest.id).toMatch(/^urn:awp:workspace:/);
      expect(manifest.created).toBeDefined();
      expect(manifest.agent.identityFile).toBe("IDENTITY.md");
      expect(manifest.capabilities).toEqual([]);
      expect(manifest.protocols).toEqual({ a2a: true, mcp: true });
    });

    it("sets created timestamp to current time", () => {
      const before = new Date().toISOString();
      const manifest = createDefaultManifest("test");
      const after = new Date().toISOString();

      expect(manifest.created >= before).toBe(true);
      expect(manifest.created <= after).toBe(true);
    });
  });
});
