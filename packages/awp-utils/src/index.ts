/**
 * @agent-workspace/utils
 *
 * Shared utilities for AWP packages including validation,
 * reputation calculations, frontmatter parsing, and workspace helpers.
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

// Workspace utilities
export {
  findWorkspaceRoot,
  loadManifest,
  fileExists,
  getAgentDid,
  safeReadFile,
  getWorkspaceRoot,
} from "./workspace.js";

// Graph utilities (dependency analysis)
export {
  type TaskNode,
  type DependencyGraph,
  type GraphAnalysis,
  buildGraph,
  topologicalSort,
  detectCycles,
  findCriticalPath,
  getBlockedTasks,
  analyzeGraph,
  getTaskSlug,
  getProjectSlug,
} from "./graph.js";

// Safe I/O utilities
export {
  atomicWriteFile,
  withFileLock,
  safeWriteJson,
  loadJsonFile,
  type AtomicWriteOptions,
  type FileLockOptions,
} from "./safe-io.js";

// Swarm utilities (recruitment)
export {
  type RecruitmentCandidate,
  type RecruitmentResult,
  findCandidatesForRole,
  autoRecruitSwarm,
  isSwarmFullyStaffed,
  getSwarmStaffingSummary,
} from "./swarm.js";
