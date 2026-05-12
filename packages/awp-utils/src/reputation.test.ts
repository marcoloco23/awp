import { describe, it, expect } from "vitest";
import {
  computeConfidence,
  computeDecayedScore,
  updateDimension,
  computeWeightedScore,
} from "./reputation.js";

describe("computeConfidence", () => {
  it("returns 0 for zero samples", () => {
    expect(computeConfidence(0)).toBe(0);
  });
  it("grows monotonically with sample size", () => {
    const c1 = computeConfidence(1);
    const c10 = computeConfidence(10);
    const c100 = computeConfidence(100);
    expect(c1).toBeLessThan(c10);
    expect(c10).toBeLessThan(c100);
    expect(c100).toBeLessThan(1);
  });
  it("matches the formula 1 - 1/(1 + n*0.1)", () => {
    expect(computeConfidence(10)).toBe(0.5);
  });
});

describe("computeDecayedScore", () => {
  it("returns original score when no time has elapsed", () => {
    const now = new Date("2026-05-12T00:00:00Z");
    const dim = { score: 0.8, confidence: 0.5, sampleSize: 5, lastSignal: now.toISOString() };
    expect(computeDecayedScore(dim, now)).toBe(0.8);
  });
  it("decays toward 0.5 baseline over time", () => {
    const lastSignal = new Date("2025-01-01T00:00:00Z");
    const now = new Date("2026-05-12T00:00:00Z"); // many months later
    const high = { score: 0.95, confidence: 0.9, sampleSize: 20, lastSignal: lastSignal.toISOString() };
    const low = { score: 0.05, confidence: 0.9, sampleSize: 20, lastSignal: lastSignal.toISOString() };
    const hd = computeDecayedScore(high, now);
    const ld = computeDecayedScore(low, now);
    expect(hd).toBeLessThan(0.95);
    expect(hd).toBeGreaterThan(0.5);
    expect(ld).toBeGreaterThan(0.05);
    expect(ld).toBeLessThan(0.5);
  });
  it("does not decay past the baseline", () => {
    const lastSignal = new Date("2000-01-01T00:00:00Z");
    const now = new Date("2026-05-12T00:00:00Z");
    const dim = { score: 0.9, confidence: 0.9, sampleSize: 20, lastSignal: lastSignal.toISOString() };
    const out = computeDecayedScore(dim, now);
    expect(out).toBeCloseTo(0.5, 1);
  });
});

describe("updateDimension", () => {
  const now = new Date("2026-05-12T00:00:00Z");
  it("creates a fresh dimension on first signal", () => {
    const dim = updateDimension(undefined, 0.8, now);
    expect(dim.score).toBe(0.8);
    expect(dim.sampleSize).toBe(1);
    expect(dim.lastSignal).toBe(now.toISOString());
  });
  it("applies EWMA on existing dimensions", () => {
    const existing = { score: 0.7, confidence: 0.5, sampleSize: 5, lastSignal: now.toISOString() };
    const updated = updateDimension(existing, 0.9, now); // alpha=0.15
    // 0.15*0.9 + 0.85*0.7 = 0.73
    expect(updated.score).toBe(0.73);
    expect(updated.sampleSize).toBe(6);
  });
  it("respects custom alpha", () => {
    const existing = { score: 0.5, confidence: 0.5, sampleSize: 5, lastSignal: now.toISOString() };
    const updated = updateDimension(existing, 1.0, now, 0.5);
    // 0.5*1 + 0.5*0.5 = 0.75
    expect(updated.score).toBe(0.75);
  });
});

describe("computeWeightedScore", () => {
  it("returns baseline (0.5) when total weight is 0", () => {
    expect(computeWeightedScore([])).toBe(0.5);
  });
  it("computes correct weighted average", () => {
    // 0.8*0.5 + 0.6*0.5 = 0.7
    expect(computeWeightedScore([[0.8, 0.5], [0.6, 0.5]])).toBe(0.7);
  });
  it("weights heavier samples more", () => {
    // 0.9*0.9 + 0.1*0.1 = 0.81+0.01 = 0.82; /1.0 = 0.82
    expect(computeWeightedScore([[0.9, 0.9], [0.1, 0.1]])).toBe(0.82);
  });
});
