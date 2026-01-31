/**
 * @agent-workspace/utils
 *
 * Shared utilities for AWP packages including validation,
 * reputation calculations, and frontmatter parsing.
 */

// Validation utilities
export {
  validateSlug,
  sanitizeSlug,
  validatePath,
  isValidDate,
  isValidTimestamp,
} from "./validation.js";

// Reputation utilities
export {
  computeConfidence,
  computeDecayedScore,
  updateDimension,
  computeWeightedScore,
} from "./reputation.js";

// Frontmatter utilities
export {
  parseWorkspaceFile,
  serializeWorkspaceFile,
  writeWorkspaceFile,
  getFrontmatterType,
} from "./frontmatter.js";
