import {
  REPUTATION_EWMA_ALPHA,
  REPUTATION_DECAY_RATE,
  REPUTATION_BASELINE,
  MS_PER_MONTH,
  type ReputationDimension,
} from "@agent-workspace/core";

/**
 * Compute confidence from sample size.
 * Formula: confidence = 1 - 1/(1 + sampleSize * 0.1)
 *
 * @param sampleSize - Number of samples
 * @returns Confidence value (0.0 to ~1.0)
 */
export function computeConfidence(sampleSize: number): number {
  return Math.round((1 - 1 / (1 + sampleSize * 0.1)) * 100) / 100;
}

/**
 * Apply time-based decay to a reputation score.
 * Scores decay toward REPUTATION_BASELINE (0.5) over time.
 *
 * @param dim - The reputation dimension to decay
 * @param now - Current date (defaults to now)
 * @param decayRate - Monthly decay rate (defaults to REPUTATION_DECAY_RATE)
 * @returns The decayed score
 */
export function computeDecayedScore(
  dim: ReputationDimension,
  now: Date = new Date(),
  decayRate: number = REPUTATION_DECAY_RATE
): number {
  const lastSignalDate = new Date(dim.lastSignal);
  const monthsElapsed = (now.getTime() - lastSignalDate.getTime()) / MS_PER_MONTH;

  if (monthsElapsed <= 0) return dim.score;

  const decayFactor = Math.exp(-decayRate * monthsElapsed);

  // Decay toward baseline (0.5)
  const decayed = REPUTATION_BASELINE + (dim.score - REPUTATION_BASELINE) * decayFactor;

  return Math.round(decayed * 1000) / 1000;
}

/**
 * Update a reputation dimension with a new signal using EWMA.
 *
 * @param existing - Existing dimension (undefined for first signal)
 * @param signalScore - The new signal score (0.0 to 1.0)
 * @param now - Current date (defaults to now)
 * @param alpha - EWMA learning rate (defaults to REPUTATION_EWMA_ALPHA)
 * @returns Updated reputation dimension
 */
export function updateDimension(
  existing: ReputationDimension | undefined,
  signalScore: number,
  now: Date = new Date(),
  alpha: number = REPUTATION_EWMA_ALPHA
): ReputationDimension {
  const timestamp = now.toISOString();

  if (!existing) {
    return {
      score: signalScore,
      confidence: computeConfidence(1),
      sampleSize: 1,
      lastSignal: timestamp,
    };
  }

  // Apply decay to old score before EWMA
  const decayed = computeDecayedScore(existing, now);
  const newScore = alpha * signalScore + (1 - alpha) * decayed;
  const newSampleSize = existing.sampleSize + 1;

  return {
    score: Math.round(newScore * 1000) / 1000,
    confidence: computeConfidence(newSampleSize),
    sampleSize: newSampleSize,
    lastSignal: timestamp,
  };
}

/**
 * Compute a weighted average of multiple dimension scores.
 *
 * @param scores - Array of [score, weight] tuples
 * @returns Weighted average score
 */
export function computeWeightedScore(scores: Array<[number, number]>): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [score, weight] of scores) {
    weightedSum += score * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return REPUTATION_BASELINE;

  return Math.round((weightedSum / totalWeight) * 1000) / 1000;
}
