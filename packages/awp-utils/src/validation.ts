import { resolve, relative, isAbsolute } from "node:path";

/** Pattern for valid slugs (lowercase alphanumeric with hyphens, not starting with hyphen) */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/** Maximum slug length */
const MAX_SLUG_LENGTH = 100;

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
