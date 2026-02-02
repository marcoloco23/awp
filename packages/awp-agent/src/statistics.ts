/**
 * Statistical comparison utilities for AWP experiments.
 *
 * Implements hypothesis testing for comparing experiment results
 * across different manifesto configurations.
 */

import type { ExperimentResult, CycleResult, AgentReputation } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DescriptiveStats {
  n: number;
  mean: number;
  stddev: number;
  min: number;
  max: number;
  median: number;
}

export interface TestResult {
  testName: string;
  statistic: number;
  pValue: number;
  significant: boolean;
  effectSize: number;
  effectLabel: "negligible" | "small" | "medium" | "large";
}

export interface MetricComparison {
  metric: string;
  a: DescriptiveStats;
  b: DescriptiveStats;
  test: TestResult;
}

export interface ExperimentComparison {
  experimentA: string;
  experimentB: string;
  manifestoA: string;
  manifestoB: string;
  metrics: MetricComparison[];
  summary: {
    significantDifferences: number;
    totalMetrics: number;
    winner: "A" | "B" | "tie";
    winCount: { A: number; B: number };
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Descriptive Statistics
// ─────────────────────────────────────────────────────────────────────────────

export function computeDescriptiveStats(values: number[]): DescriptiveStats {
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: 0, stddev: 0, min: 0, max: 0, median: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / Math.max(n - 1, 1);
  const stddev = Math.sqrt(variance);
  const median =
    n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)];

  return {
    n,
    mean,
    stddev,
    min: sorted[0],
    max: sorted[n - 1],
    median,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Welch's t-test (unequal variance two-sample t-test)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Welch's t-test for two independent samples with unequal variance.
 * Returns the t-statistic, degrees of freedom, and approximate p-value.
 */
export function welchTTest(
  a: number[],
  b: number[],
  alpha: number = 0.05
): TestResult {
  const statsA = computeDescriptiveStats(a);
  const statsB = computeDescriptiveStats(b);

  // Handle degenerate cases
  if (statsA.n < 2 || statsB.n < 2) {
    return {
      testName: "Welch's t-test",
      statistic: 0,
      pValue: 1,
      significant: false,
      effectSize: 0,
      effectLabel: "negligible",
    };
  }

  const varA = statsA.stddev ** 2;
  const varB = statsB.stddev ** 2;
  const nA = statsA.n;
  const nB = statsB.n;

  const seA = varA / nA;
  const seB = varB / nB;
  const seDiff = Math.sqrt(seA + seB);

  if (seDiff === 0) {
    return {
      testName: "Welch's t-test",
      statistic: 0,
      pValue: 1,
      significant: false,
      effectSize: 0,
      effectLabel: "negligible",
    };
  }

  const t = (statsA.mean - statsB.mean) / seDiff;

  // Welch-Satterthwaite degrees of freedom
  const df = (seA + seB) ** 2 / ((seA ** 2) / (nA - 1) + (seB ** 2) / (nB - 1));

  // Approximate p-value using the t-distribution
  const pValue = tDistributionPValue(Math.abs(t), df) * 2; // two-tailed

  // Cohen's d effect size
  const pooledStd = Math.sqrt(
    ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2)
  );
  const effectSize = pooledStd > 0 ? Math.abs(statsA.mean - statsB.mean) / pooledStd : 0;

  return {
    testName: "Welch's t-test",
    statistic: t,
    pValue: Math.min(1, pValue),
    significant: pValue < alpha,
    effectSize,
    effectLabel: categorizeEffectSize(effectSize),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mann-Whitney U Test (non-parametric alternative)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mann-Whitney U test for two independent samples.
 * Non-parametric alternative to t-test when normality cannot be assumed.
 */
export function mannWhitneyU(
  a: number[],
  b: number[],
  alpha: number = 0.05
): TestResult {
  const nA = a.length;
  const nB = b.length;

  if (nA === 0 || nB === 0) {
    return {
      testName: "Mann-Whitney U",
      statistic: 0,
      pValue: 1,
      significant: false,
      effectSize: 0,
      effectLabel: "negligible",
    };
  }

  // Combine and rank all values
  const combined = [
    ...a.map((v) => ({ value: v, group: "a" as const })),
    ...b.map((v) => ({ value: v, group: "b" as const })),
  ];
  combined.sort((x, y) => x.value - y.value);

  // Assign ranks (handle ties with average rank)
  const ranks = new Map<number, number>();
  let i = 0;
  while (i < combined.length) {
    let j = i;
    while (j < combined.length && combined[j].value === combined[i].value) {
      j++;
    }
    // Average rank for ties
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks.set(k, avgRank);
    }
    i = j;
  }

  // Sum ranks for group A
  let rankSumA = 0;
  for (let idx = 0; idx < combined.length; idx++) {
    if (combined[idx].group === "a") {
      rankSumA += ranks.get(idx)!;
    }
  }

  // U statistic
  const uA = rankSumA - (nA * (nA + 1)) / 2;
  const uB = nA * nB - uA;
  const U = Math.min(uA, uB);

  // Normal approximation for p-value (valid for n >= 8)
  const meanU = (nA * nB) / 2;
  const stdU = Math.sqrt((nA * nB * (nA + nB + 1)) / 12);

  let pValue: number;
  if (stdU === 0) {
    pValue = 1;
  } else {
    const z = (U - meanU) / stdU;
    pValue = 2 * normalCDF(-Math.abs(z)); // two-tailed
  }

  // r effect size = Z / sqrt(N)
  const totalN = nA + nB;
  const z = stdU > 0 ? (U - meanU) / stdU : 0;
  const effectSize = totalN > 0 ? Math.abs(z) / Math.sqrt(totalN) : 0;

  return {
    testName: "Mann-Whitney U",
    statistic: U,
    pValue: Math.min(1, pValue),
    significant: pValue < alpha,
    effectSize,
    effectLabel: categorizeEffectSize(effectSize),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Experiment Comparison
// ─────────────────────────────────────────────────────────────────────────────

/** Extract per-cycle success rates from an experiment */
function extractSuccessRates(exp: ExperimentResult): number[] {
  return exp.cycles.map((c) => c.metrics.successRate);
}

/** Extract per-cycle token efficiency (tasks per 1K tokens) */
function extractTokenEfficiency(exp: ExperimentResult): number[] {
  return exp.cycles.map((c) =>
    c.metrics.totalTokens > 0
      ? (c.metrics.tasksSucceeded / c.metrics.totalTokens) * 1000
      : 0
  );
}

/** Extract per-cycle reputation stability (1 - avg absolute delta) */
function extractReputationStability(exp: ExperimentResult): number[] {
  return exp.cycles.map((c) => {
    if (c.reputationChanges.length === 0) return 1;
    const avgDelta =
      c.reputationChanges.reduce((sum, ch) => sum + Math.abs(ch.delta), 0) /
      c.reputationChanges.length;
    return Math.max(0, 1 - avgDelta);
  });
}

/** Extract per-cycle anti-pattern count */
function extractAntiPatternRate(exp: ExperimentResult): number[] {
  return exp.cycles.map((c) => c.metrics.antiPatternsDetected.length);
}

/** Extract final overall reputation scores */
function extractFinalReputations(exp: ExperimentResult): number[] {
  return Object.values(exp.finalReputations).map((r) => r.overallScore);
}

/**
 * Compare two experiments with statistical hypothesis testing.
 *
 * Uses Welch's t-test (parametric) and Mann-Whitney U (non-parametric)
 * across multiple metrics to determine if the experiments produced
 * significantly different outcomes.
 */
export function compareExperiments(
  a: ExperimentResult,
  b: ExperimentResult,
  options: { alpha?: number; test?: "t-test" | "mann-whitney" } = {}
): ExperimentComparison {
  const alpha = options.alpha ?? 0.05;
  const testFn = options.test === "mann-whitney" ? mannWhitneyU : welchTTest;

  const metricExtractors: Array<{
    name: string;
    extract: (exp: ExperimentResult) => number[];
    higherIsBetter: boolean;
  }> = [
    { name: "Success Rate", extract: extractSuccessRates, higherIsBetter: true },
    { name: "Token Efficiency", extract: extractTokenEfficiency, higherIsBetter: true },
    { name: "Trust Stability", extract: extractReputationStability, higherIsBetter: true },
    { name: "Anti-Pattern Rate", extract: extractAntiPatternRate, higherIsBetter: false },
    { name: "Final Reputation", extract: extractFinalReputations, higherIsBetter: true },
  ];

  const metrics: MetricComparison[] = [];
  let winsA = 0;
  let winsB = 0;

  for (const { name, extract, higherIsBetter } of metricExtractors) {
    const valuesA = extract(a);
    const valuesB = extract(b);

    const statsA = computeDescriptiveStats(valuesA);
    const statsB = computeDescriptiveStats(valuesB);
    const test = testFn(valuesA, valuesB, alpha);

    metrics.push({ metric: name, a: statsA, b: statsB, test });

    // Determine winner for this metric
    if (test.significant) {
      if (higherIsBetter) {
        if (statsA.mean > statsB.mean) winsA++;
        else winsB++;
      } else {
        if (statsA.mean < statsB.mean) winsA++;
        else winsB++;
      }
    }
  }

  const significantDifferences = metrics.filter((m) => m.test.significant).length;

  return {
    experimentA: a.experimentId,
    experimentB: b.experimentId,
    manifestoA: a.manifestoId,
    manifestoB: b.manifestoId,
    metrics,
    summary: {
      significantDifferences,
      totalMetrics: metrics.length,
      winner: winsA > winsB ? "A" : winsB > winsA ? "B" : "tie",
      winCount: { A: winsA, B: winsB },
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Math Utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Standard normal CDF approximation (Abramowitz & Stegun 26.2.17) */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Approximate p-value from t-distribution using the normal approximation
 * with Cornish-Fisher expansion for moderate df.
 *
 * For df >= 30, t-distribution approaches normal.
 * For smaller df, uses a correction factor.
 */
function tDistributionPValue(t: number, df: number): number {
  if (df <= 0) return 1;

  // For large df, use normal approximation
  if (df >= 100) {
    return 1 - normalCDF(t);
  }

  // Use the regularized incomplete beta function approximation
  // P(T > t) ≈ 0.5 * I(df / (df + t^2), df/2, 0.5)
  const x = df / (df + t * t);
  return 0.5 * regularizedIncompleteBeta(x, df / 2, 0.5);
}

/**
 * Regularized incomplete beta function approximation using continued fraction.
 * I_x(a, b) = B_x(a,b) / B(a,b)
 */
function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use the continued fraction representation (Lentz's algorithm)
  // For numerical stability, swap if x > (a+1)/(a+b+2)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - regularizedIncompleteBeta(1 - x, b, a);
  }

  const lnBeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lnBeta) / a;

  // Lentz's continued fraction
  let f = 1;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  f = d;

  for (let m = 1; m <= 200; m++) {
    // Even step
    let numerator = (m * (b - m) * x) / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    f *= c * d;

    // Odd step
    numerator = -((a + m) * (a + b + m) * x) / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1) < 1e-10) break;
  }

  return front * f;
}

/** Log-gamma function approximation (Stirling's) */
function lgamma(x: number): number {
  if (x <= 0) return 0;

  // Lanczos approximation
  const g = 7;
  const coefs = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];

  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  }

  x -= 1;
  let a = coefs[0];
  const t = x + g + 0.5;
  for (let i = 1; i < coefs.length; i++) {
    a += coefs[i] / (x + i);
  }

  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** Categorize Cohen's d effect size */
function categorizeEffectSize(d: number): "negligible" | "small" | "medium" | "large" {
  if (d < 0.2) return "negligible";
  if (d < 0.5) return "small";
  if (d < 0.8) return "medium";
  return "large";
}
