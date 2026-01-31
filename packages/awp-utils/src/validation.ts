import { resolve, relative, isAbsolute } from "node:path";

/** Pattern for valid slugs (lowercase alphanumeric with hyphens, not starting with hyphen) */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Maximum slug length */
const MAX_SLUG_LENGTH = 100;

// ============================================================================
// Agent-Friendly Normalization
// ============================================================================
// These functions help agents avoid common format errors by auto-correcting
// typos and accepting common variants. This makes AWP more "plug and play".

/** Valid task statuses */
export const VALID_TASK_STATUSES = [
  "pending",
  "in-progress",
  "blocked",
  "review",
  "completed",
  "cancelled",
] as const;

/** Valid project statuses */
export const VALID_PROJECT_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
] as const;

/** Valid provenance actions */
export const VALID_PROVENANCE_ACTIONS = ["created", "updated", "merged"] as const;

/** Valid priorities */
export const VALID_PRIORITIES = ["low", "medium", "high", "critical"] as const;

/** Common typo mappings for task status */
const TASK_STATUS_ALIASES: Record<string, string> = {
  // Underscore variants
  in_progress: "in-progress",
  in_review: "review",
  // CamelCase variants
  inProgress: "in-progress",
  inReview: "review",
  // Other common typos
  "in progress": "in-progress",
  done: "completed",
  todo: "pending",
  wip: "in-progress",
  complete: "completed",
  cancelled: "cancelled",
  canceled: "cancelled",
};

/** Common typo mappings for provenance actions */
const PROVENANCE_ACTION_ALIASES: Record<string, string> = {
  drafted: "created",
  create: "created",
  update: "updated",
  edit: "updated",
  edited: "updated",
  modified: "updated",
  merge: "merged",
};

/**
 * Normalize a task status, accepting common variants and typos.
 * Returns the canonical status or null if unrecognizable.
 *
 * @example
 * normalizeTaskStatus("in_progress") // => "in-progress"
 * normalizeTaskStatus("WIP") // => "in-progress"
 * normalizeTaskStatus("garbage") // => null
 */
export function normalizeTaskStatus(status: string): string | null {
  const lower = status.toLowerCase().trim();

  // Direct match
  if ((VALID_TASK_STATUSES as readonly string[]).includes(lower)) {
    return lower;
  }

  // Alias match
  if (TASK_STATUS_ALIASES[lower]) {
    return TASK_STATUS_ALIASES[lower];
  }

  return null;
}

/**
 * Normalize a provenance action, accepting common variants.
 * Returns the canonical action or null if unrecognizable.
 *
 * @example
 * normalizeProvenanceAction("drafted") // => "created"
 * normalizeProvenanceAction("edit") // => "updated"
 */
export function normalizeProvenanceAction(action: string): string | null {
  const lower = action.toLowerCase().trim();

  // Direct match
  if ((VALID_PROVENANCE_ACTIONS as readonly string[]).includes(lower)) {
    return lower;
  }

  // Alias match
  if (PROVENANCE_ACTION_ALIASES[lower]) {
    return PROVENANCE_ACTION_ALIASES[lower];
  }

  return null;
}

/**
 * Suggest the closest valid value for a given input.
 * Returns the suggestion and a helpful error message.
 *
 * @example
 * suggestValidValue("in_progress", VALID_TASK_STATUSES)
 * // => { suggestion: "in-progress", message: "Did you mean 'in-progress'?" }
 */
export function suggestValidValue(
  input: string,
  validValues: readonly string[]
): { suggestion: string | null; message: string } {
  const lower = input.toLowerCase().trim();

  // Check for underscore/camelCase variants
  const hyphenated = lower
    .replace(/_/g, "-")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase();
  if (validValues.includes(hyphenated)) {
    return {
      suggestion: hyphenated,
      message: `Did you mean '${hyphenated}'? (Use hyphens, not underscores)`,
    };
  }

  // Simple Levenshtein-like check for close matches
  for (const valid of validValues) {
    if (levenshteinDistance(lower, valid) <= 2) {
      return {
        suggestion: valid,
        message: `Did you mean '${valid}'?`,
      };
    }
  }

  return {
    suggestion: null,
    message: `Valid values: ${validValues.join(", ")}`,
  };
}

/**
 * Simple Levenshtein distance for typo detection.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Validate an artifact or profile slug.
 * Slugs must be lowercase alphanumeric with hyphens, not starting with hyphen.
 *
 * @param slug - The slug to validate
 * @returns true if valid, false otherwise
 */
export function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length <= MAX_SLUG_LENGTH;
}

/**
 * Validate and sanitize a slug, throwing an error if invalid.
 *
 * @param slug - The slug to validate
 * @returns The sanitized slug (trimmed, lowercased)
 * @throws Error if slug is invalid
 */
export function sanitizeSlug(slug: string): string {
  const trimmed = slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(trimmed)) {
    throw new Error(
      `Invalid slug: "${slug}". Must be lowercase alphanumeric with hyphens, not starting with hyphen.`
    );
  }
  if (trimmed.length > MAX_SLUG_LENGTH) {
    throw new Error(`Slug too long: max ${MAX_SLUG_LENGTH} characters`);
  }
  return trimmed;
}

/**
 * Validate that a path is within a root directory (prevents directory traversal).
 *
 * @param root - The root directory path
 * @param targetPath - The path to validate (relative or absolute)
 * @returns The normalized absolute path
 * @throws Error if path traversal is detected
 */
export function validatePath(root: string, targetPath: string): string {
  const normalized = resolve(root, targetPath);
  const rel = relative(root, normalized);

  // Prevent directory traversal
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }

  return normalized;
}

/**
 * Check if a string is a valid ISO 8601 date (YYYY-MM-DD).
 *
 * @param dateStr - The date string to validate
 * @returns true if valid, false otherwise
 * @internal Utility function for future validation use
 */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Check if a string is a valid ISO 8601 timestamp.
 *
 * @param timestamp - The timestamp string to validate
 * @returns true if valid, false otherwise
 * @internal Utility function for future validation use
 */
export function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}
