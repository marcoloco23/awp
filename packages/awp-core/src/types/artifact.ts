import type { BaseFrontmatter } from "./workspace.js";

/**
 * A single entry in an artifact's provenance log.
 */
export interface ProvenanceEntry {
  /** DID of the agent that performed this action */
  agent: string;
  /** What was done */
  action: "created" | "updated" | "merged" | "synced";
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Optional commit message */
  message?: string;
  /** Agent's confidence at the time of this action (0.0 - 1.0) */
  confidence?: number;
  /** Source workspace identifier when action is "synced" */
  syncSource?: string;
}

/**
 * Knowledge Artifact frontmatter (artifacts/<slug>.md)
 */
export interface ArtifactFrontmatter extends BaseFrontmatter {
  type: "knowledge-artifact";
  /** SMP protocol version */
  smp: string;
  /** Artifact identifier (format: artifact:<slug>) */
  id: string;
  /** Human-readable title */
  title: string;
  /** DIDs of contributing agents */
  authors: string[];
  /** Monotonically increasing version number */
  version: number;
  /** Agent confidence in this artifact's accuracy (0.0 - 1.0) */
  confidence?: number;
  /** Categorization tags */
  tags?: string[];
  /** ISO 8601 creation timestamp */
  created: string;
  /** Append-only provenance log */
  provenance: ProvenanceEntry[];
}
