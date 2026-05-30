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

/** Resolved per-detector tuning, derived from manifesto frontmatter. */
interface DetectorOptions {
  threshold: number;
  windowMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Frontmatter-driven configuration
//
// Thresholds and measurement windows are no longer hardcoded: they are read
// from each manifesto anti-pattern entry. Precedence, highest first:
//   1. explicit `threshold` / `window` frontmatter fields
//   2. values parsed from the `detector` expression (e.g. "... > 10/day")
//   3. the detector's built-in default
// ─────────────────────────────────────────────────────────────────────────────

/** Time-unit suffixes accepted in `detector` expressions and `window` fields. */
const WINDOW_UNIT_MS: Record<string, number> = {
  h: 3_600_000,
  hour: 3_600_000,
  hr: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  w: 604_800_000,
  week: 604_800_000,
  mo: 2_592_000_000, // 30 days
  month: 2_592_000_000,
};

/**
 * Parse a window specifier (e.g. "day", "7d", "12h", "2 weeks") into
 * milliseconds. Returns undefined when it cannot be parsed.
 */
export function parseWindowMs(spec: string | undefined): number | undefined {
  if (!spec) return undefined;
  const m = spec.trim().toLowerCase().match(/^(\d+(?:\.\d+)?)?\s*([a-z]+)$/);
  if (!m) return undefined;
  const unit = m[2];
  // Accept plural units ("days", "weeks") by stripping a trailing 's'.
  const unitMs = WINDOW_UNIT_MS[unit] ?? WINDOW_UNIT_MS[unit.replace(/s$/, "")];
  if (unitMs === undefined) return undefined;
  const count = m[1] ? parseFloat(m[1]) : 1;
  return count * unitMs;
}

/**
 * Parse a `detector` expression like "artifact-creation-rate > 10/day" or
 * "evaluator-diversity < 2", extracting the numeric threshold and (optional)
 * measurement window.
 */
export function parseDetectorExpression(detector: string): {
  threshold?: number;
  windowMs?: number;
} {
  const result: { threshold?: number; windowMs?: number } = {};
  const cmp = detector.match(/[<>]=?\s*(\d+(?:\.\d+)?)/);
  if (cmp) result.threshold = parseFloat(cmp[1]);
  const win = detector.match(/\/\s*(\d+(?:\.\d+)?)?\s*([a-z]+)/i);
  if (win) {
    const ms = parseWindowMs(`${win[1] ?? ""}${win[2]}`);
    if (ms !== undefined) result.windowMs = ms;
  }
  return result;
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

/** A configurable detector and the metadata needed to resolve & tune it. */
interface DetectorEntry {
  /** Canonical detector id. */
  id: string;
  /**
   * Alternative names that may appear as a manifesto pattern `id` or as the
   * leading metric token of a `detector` expression. Lets author-facing names
   * (e.g. "attention-hacking", "artifact-creation-rate") map to one detector.
   */
  aliases: string[];
  /** Built-in fallbacks used when frontmatter does not specify them. */
  defaults: DetectorOptions;
  /** Whether this detector observes a time window (false ⇒ window ignored). */
  windowed: boolean;
  run: (agent: AgentAdapter, opts: DetectorOptions) => Promise<AntiPatternDetection | null>;
}

const DETECTOR_REGISTRY: DetectorEntry[] = [
  {
    id: "artifact-spam",
    aliases: ["attention-hacking", "artifact-creation-rate", "artifact-spam-rate"],
    defaults: { threshold: 10, windowMs: 86_400_000 },
    windowed: true,
    run: (agent, { threshold, windowMs }) => detectArtifactSpam(agent, threshold, windowMs),
  },
  {
    id: "self-promotion",
    aliases: ["self-reported-positive-signals", "self-dealing"],
    defaults: { threshold: 3, windowMs: 604_800_000 },
    windowed: true,
    run: (agent, { threshold, windowMs }) => detectSelfPromotion(agent, threshold, windowMs),
  },
  {
    id: "coalition-capture",
    aliases: ["evaluator-diversity", "evaluator-monoculture", "coalition"],
    defaults: { threshold: 2, windowMs: 0 },
    windowed: false,
    run: (agent, { threshold }) => detectCoalitionCapture(agent, threshold),
  },
];

/** Leading metric token of a detector expression, e.g. "artifact-creation-rate". */
function detectorMetric(detector: string): string {
  return detector.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

/** Resolve a manifesto pattern to a registered detector via id, then aliases. */
function resolveDetector(pattern: ManifestoConfig["antiPatterns"][number]): DetectorEntry | null {
  const id = pattern.id.toLowerCase();
  const metric = detectorMetric(pattern.detector);
  return (
    DETECTOR_REGISTRY.find(
      (d) =>
        d.id === id ||
        d.aliases.includes(id) ||
        d.id === metric ||
        d.aliases.includes(metric)
    ) ?? null
  );
}

/**
 * Resolve effective threshold/window for a pattern. Precedence: explicit
 * frontmatter fields, then values parsed from the `detector` expression, then
 * the detector's built-in defaults.
 */
function resolveOptions(
  pattern: ManifestoConfig["antiPatterns"][number],
  entry: DetectorEntry
): DetectorOptions {
  const parsed = parseDetectorExpression(pattern.detector);
  const windowFromField = parseWindowMs(pattern.window);
  return {
    threshold: pattern.threshold ?? parsed.threshold ?? entry.defaults.threshold,
    windowMs: entry.windowed
      ? (windowFromField ?? parsed.windowMs ?? entry.defaults.windowMs)
      : entry.defaults.windowMs,
  };
}

const DEFAULT_PATTERNS: ManifestoConfig["antiPatterns"] = [
  { id: "artifact-spam", detector: "artifact-creation-rate > 10/day", penalty: 0.2 },
  { id: "self-promotion", detector: "self-reported-positive-signals > 3/week", penalty: 0.3 },
  { id: "coalition-capture", detector: "evaluator-diversity < 2", penalty: 0.4 },
];

/**
 * Run all configured anti-pattern detectors for a set of agents.
 *
 * The manifesto's `antiPatterns` frontmatter drives which detectors run, their
 * penalties, and — now — their thresholds and measurement windows. Detector
 * selection is alias-aware, so author-facing pattern names like
 * "attention-hacking" resolve to the underlying detector.
 */
export async function detectAntiPatterns(
  agents: AgentAdapter[],
  manifesto: ManifestoConfig
): Promise<AntiPatternDetection[]> {
  const detections: AntiPatternDetection[] = [];

  const patterns =
    manifesto.antiPatterns.length > 0 ? manifesto.antiPatterns : DEFAULT_PATTERNS;

  for (const agent of agents) {
    for (const pattern of patterns) {
      const entry = resolveDetector(pattern);
      if (!entry) continue;

      const detection = await entry.run(agent, resolveOptions(pattern, entry));
      if (detection) {
        // Report against the manifesto's configured id and penalty so detections
        // are traceable back to the frontmatter that triggered them.
        detection.patternId = pattern.id;
        detection.penalty = pattern.penalty;
        detections.push(detection);
      }
    }
  }

  return detections;
}
