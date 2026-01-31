import type { BaseFrontmatter } from "./workspace.js";

/**
 * Task definition within a delegation contract
 */
export interface ContractTask {
  description: string;
  outputFormat?: string;
  outputSlug?: string;
}

/**
 * Scope constraints for a delegation contract
 */
export interface ContractScope {
  include?: string[];
  exclude?: string[];
}

/**
 * Behavioral constraints for a delegation contract
 */
export interface ContractConstraints {
  requireCitations?: boolean;
  confidenceThreshold?: number;
}

/**
 * Evaluation criteria and results
 */
export interface ContractEvaluation {
  criteria: Record<string, number>;
  result: Record<string, number> | null;
}

/**
 * Delegation contract frontmatter (contracts/<slug>.md)
 */
export interface DelegationContractFrontmatter extends BaseFrontmatter {
  type: "delegation-contract";
  rdp: string;
  id: string;
  status: "draft" | "active" | "completed" | "evaluated";
  delegator: string;
  delegate: string;
  delegateSlug: string;
  created: string;
  deadline?: string;
  task: ContractTask;
  scope?: ContractScope;
  constraints?: ContractConstraints;
  evaluation: ContractEvaluation;
}
