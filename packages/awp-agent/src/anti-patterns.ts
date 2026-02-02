/**
 * Anti-pattern detection for AWP experiments.
 *
 * Detects and penalizes degenerate agent behaviors during experiment cycles:
 * - Attention hacking (artifact spam)
 * - Self-promotion (self-reported positive reputation signals)
 * - Coalition capture (evaluator monoculture)
 *
 * Configured via manifesto antiPatterns field.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ARTIFACTS_DIR, REPUTATION_DIR, CONTRACTS_DIR } from "@agent-workspace/core";
import matter from "gray-matter";
import type { ReputationSignal } from "@agent-workspace/core";
import type { ManifestoConfig, AgentAdapter } from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AntiPatternDetection {
  patternId: string;
  agentId: string;
  penalty: number;
  evidence: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detectors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect artifact spam (attention hacking).
 *
 * Triggers when an agent creates more artifacts than the threshold
 * within the measurement window. Default threshold: 10 per day.
 */
async function detectArtifactSpam(
  agent: AgentAdapter,
  threshold: number = 10,
  windowMs: number = 86_400_000 // 24 hours
): Promise<AntiPatternDetection | null> {
  const artifactsDir = join(agent.workspace, ARTIFACTS_DIR);
  const now = Date.now();

  let files: string[];
  try {
    files = await readdir(artifactsDir);
  } catch {
    return null;
  }

  let recentCount = 0;
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    try {
      const raw = await readFile(join(artifactsDir, file), "utf-8");
      const { data } = matter(raw);
      const created = data.created || data.lastModified;
      if (created && now - new Date(created as string).getTime() < windowMs) {
        recentCount++;
      }
    } catch {
      continue;
    }
  }

  if (recentCount > threshold) {
    return {
      patternId: "artifact-spam",
      agentId: agent.id,
      penalty: 0.2,
      evidence: `${recentCount} artifacts created in last ${Math.round(windowMs / 3_600_000)}h (threshold: ${threshold})`,
    };
  }

  return null;
}

/**
 * Detect self-promotion.
 *
 * Triggers when an agent has generated positive reputation signals
 * about themselves. Default threshold: 3 self-positive signals per week.
 */
async function detectSelfPromotion(
  agent: AgentAdapter,
  threshold: number = 3,
  windowMs: number = 604_800_000 // 7 days
): Promise<AntiPatternDetection | null> {
  const repDir = join(agent.workspace, REPUTATION_DIR);
  const repFile = join(repDir, `${agent.id}.md`);
  const now = Date.now();

  try {
    const raw = await readFile(repFile, "utf-8");
    const { data } = matter(raw);
    const signals = (data.signals as ReputationSignal[]) || [];

    let selfPositiveCount = 0;
    for (const signal of signals) {
      // Self-promotion: signal source matches the agent's own DID and score is positive
      if (
        signal.source === agent.did &&
        signal.score > 0.7 &&
        now - new Date(signal.timestamp).getTime() < windowMs
      ) {
        selfPositiveCount++;
      }
    }

    if (selfPositiveCount > threshold) {
      return {
        patternId: "self-promotion",
        agentId: agent.id,
        penalty: 0.3,
        evidence: `${selfPositiveCount} self-reported positive signals in last ${Math.round(windowMs / 86_400_000)} days (threshold: ${threshold})`,
      };
    }
  } catch {
    // No reputation file — no self-promotion possible
  }

  return null;
}

/**
 * Detect coalition capture.
 *
 * Triggers when an agent's contracts are evaluated by fewer
 * than the required number of unique evaluators. Default threshold: 2.
 */
async function detectCoalitionCapture(
  agent: AgentAdapter,
  threshold: number = 2
): Promise<AntiPatternDetection | null> {
  const contractsDir = join(agent.workspace, CONTRACTS_DIR);

  let files: string[];
  try {
    files = await readdir(contractsDir);
  } catch {
    return null;
  }

  const evaluators = new Set<string>();
  let evaluatedCount = 0;

  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    try {
      const raw = await readFile(join(contractsDir, file), "utf-8");
      const { data } = matter(raw);

      // Only look at evaluated contracts where this agent was the delegate
      if (data.status === "evaluated" && data.delegate === agent.did) {
        evaluatedCount++;
        if (data.delegator) {
          evaluators.add(data.delegator as string);
        }
      }
    } catch {
      continue;
    }
  }

  // Only flag if there are enough contracts to be meaningful
  if (evaluatedCount >= 3 && evaluators.size < threshold) {
    return {
      patternId: "coalition-capture",
      agentId: agent.id,
      penalty: 0.4,
      evidence: `Only ${evaluators.size} unique evaluator(s) across ${evaluatedCount} contracts (threshold: ${threshold})`,
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main API
// ─────────────────────────────────────────────────────────────────────────────

/** Detector function type */
type DetectorFn = (
  agent: AgentAdapter,
  ...args: number[]
) => Promise<AntiPatternDetection | null>;

/** Map of detector IDs to their functions */
const DETECTOR_REGISTRY: Record<string, DetectorFn> = {
  "artifact-spam": detectArtifactSpam as DetectorFn,
  "self-promotion": detectSelfPromotion as DetectorFn,
  "coalition-capture": detectCoalitionCapture as DetectorFn,
};

/**
 * Run all configured anti-pattern detectors for a set of agents.
 *
 * Uses the manifesto's antiPatterns configuration to determine which
 * detectors to run and what penalties to apply.
 */
export async function detectAntiPatterns(
  agents: AgentAdapter[],
  manifesto: ManifestoConfig
): Promise<AntiPatternDetection[]> {
  const detections: AntiPatternDetection[] = [];

  // If no anti-patterns configured, use defaults
  const patterns = manifesto.antiPatterns.length > 0
    ? manifesto.antiPatterns
    : [
        { id: "artifact-spam", detector: "artifact-spam-rate > 10/day", penalty: 0.2 },
        { id: "self-promotion", detector: "self-reported-positive-signals > 3/week", penalty: 0.3 },
        { id: "coalition-capture", detector: "evaluator-diversity < 2", penalty: 0.4 },
      ];

  for (const agent of agents) {
    for (const pattern of patterns) {
      // Match pattern ID to detector
      const detectorId = pattern.id;
      const detectorFn = DETECTOR_REGISTRY[detectorId];
      if (!detectorFn) continue;

      const detection = await detectorFn(agent);
      if (detection) {
        // Use manifesto-configured penalty instead of default
        detection.penalty = pattern.penalty;
        detections.push(detection);
      }
    }
  }

  return detections;
}
