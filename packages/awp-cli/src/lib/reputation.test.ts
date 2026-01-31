import { describe, it, expect } from "vitest";
import {
  validateSlug,
  slugToProfilePath,
  computeDecayedScore,
  updateDimension,
  computeConfidence,
  DEFAULT_ALPHA,
  DEFAULT_DECAY_RATE,
  SCORE_FLOOR,
} from "./reputation.js";
import type { ReputationDimension } from "@agent-workspace/core";

describe("reputation utilities", () => {
  describe("validateSlug", () => {
    it("accepts valid lowercase alphanumeric slugs", () => {
      expect(validateSlug("agent-name")).toBe(true);
      expect(validateSlug("agent123")).toBe(true);
      expect(validateSlug("a")).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(validateSlug("")).toBe(false);
      expect(validateSlug("Agent-Name")).toBe(false);
      expect(validateSlug("-starts-hyphen")).toBe(false);
    });
  });

  describe("slugToProfilePath", () => {
    it("generates correct file path", () => {
      expect(slugToProfilePath("/workspace", "agent-name")).toBe(
        "/workspace/reputation/agent-name.md"
      );
    });
  });

  describe("computeConfidence", () => {
    it("returns 0 for zero samples", () => {
      expect(computeConfidence(0)).toBe(0);
    });

    it("increases with sample size", () => {
      const c1 = computeConfidence(1);
      const c5 = computeConfidence(5);
      const c10 = computeConfidence(10);

      expect(c1).toBeGreaterThan(0);
      expect(c5).toBeGreaterThan(c1);
      expect(c10).toBeGreaterThan(c5);
    });

    it("asymptotes toward 1", () => {
      const c100 = computeConfidence(100);
      expect(c100).toBeLessThanOrEqual(1);
      expect(c100).toBeGreaterThan(0.9);
    });
  });

  describe("computeDecayedScore", () => {
    const baseDate = new Date("2024-01-15T12:00:00Z");

    it("returns original score if no time has passed", () => {
      const dim: ReputationDimension = {
        score: 0.8,
        confidence: 0.5,
        sampleSize: 5,
        lastSignal: baseDate.toISOString(),
      };

      const decayed = computeDecayedScore(dim, baseDate);
      expect(decayed).toBe(0.8);
    });

    it("decays score toward 0.5 over time", () => {
      const dim: ReputationDimension = {
        score: 0.9,
        confidence: 0.5,
        sampleSize: 5,
        lastSignal: baseDate.toISOString(),
      };

      // 6 months later
      const futureDate = new Date("2024-07-15T12:00:00Z");
      const decayed = computeDecayedScore(dim, futureDate);

      expect(decayed).toBeLessThan(0.9);
      expect(decayed).toBeGreaterThan(0.5);
    });

    it("decays low scores up toward 0.5", () => {
      const dim: ReputationDimension = {
        score: 0.2,
        confidence: 0.5,
        sampleSize: 5,
        lastSignal: baseDate.toISOString(),
      };

      // 6 months later
      const futureDate = new Date("2024-07-15T12:00:00Z");
      const decayed = computeDecayedScore(dim, futureDate);

      expect(decayed).toBeGreaterThan(0.2);
      expect(decayed).toBeLessThan(0.5);
    });
  });

  describe("updateDimension", () => {
    it("creates new dimension for first signal", () => {
      const now = new Date("2024-01-15T12:00:00Z");
      const dim = updateDimension(undefined, 0.8, now);

      expect(dim.score).toBe(0.8);
      expect(dim.sampleSize).toBe(1);
      expect(dim.lastSignal).toBe(now.toISOString());
      expect(dim.confidence).toBeGreaterThan(0);
    });

    it("updates existing dimension with EWMA", () => {
      const oldDate = new Date("2024-01-15T12:00:00Z");
      const existing: ReputationDimension = {
        score: 0.5,
        confidence: 0.09,
        sampleSize: 1,
        lastSignal: oldDate.toISOString(),
      };

      const newDate = new Date("2024-01-16T12:00:00Z");
      const updated = updateDimension(existing, 1.0, newDate);

      // EWMA with alpha=0.15: 0.15 * 1.0 + 0.85 * ~0.5
      expect(updated.score).toBeGreaterThan(0.5);
      expect(updated.score).toBeLessThan(1.0);
      expect(updated.sampleSize).toBe(2);
      expect(updated.confidence).toBeGreaterThan(existing.confidence);
    });
  });

  describe("constants", () => {
    it("has expected default values", () => {
      expect(DEFAULT_ALPHA).toBe(0.15);
      expect(DEFAULT_DECAY_RATE).toBe(0.02);
      expect(SCORE_FLOOR).toBe(0.5);
    });
  });
});
