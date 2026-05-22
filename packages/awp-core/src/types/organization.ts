import type { BaseFrontmatter } from "./workspace.js";

/**
 * Depth tier of an organization unit. Tiers descend org > division > team.
 */
export type OrgKind = "org" | "division" | "team";

/**
 * A budget line — resource amounts for one accounting dimension.
 * All fields optional; an absent field means "unconstrained" for allocation
 * and "zero" for consumption.
 */
export interface OrgBudgetLine {
  /** Model token budget */
  tokens?: number;
  /** Tool/function-call budget */
  toolCalls?: number;
  /** Monetary spend budget */
  spend?: number;
}

/**
 * Token/tool/spend budget for an organization unit.
 * `consumption` records this unit's own usage only — subtree rollup is computed.
 */
export interface OrgBudget {
  /** Accounting currency, e.g. "USD" or "tokens" (default: "tokens") */
  currency?: string;
  /** What this unit is granted */
  allocation: OrgBudgetLine;
  /** What this unit alone has consumed */
  consumption: OrgBudgetLine;
  /** Accounting window */
  period?: "one-time" | "daily" | "monthly";
}

/**
 * A capability grant — an action the unit's agents are allowed to perform.
 * Capabilities are inherited DOWN the org tree (see resolveCapabilities).
 */
export interface OrgCapability {
  /** Capability identifier, e.g. "read:artifacts", "email:client", "deploy:production" */
  name: string;
  /** Human-readable explanation */
  description?: string;
  /** True for actions that cannot be undone (deploy, email, sign, delete) */
  irreversible: boolean;
  /** True if a human must approve each use. MUST be true when `irreversible` is true. */
  requiresApproval: boolean;
  /** User ID who approves; defaults to the resolved escalation target */
  approver?: string;
  /** Set by resolveCapabilities when the grant came from an ancestor — never hand-authored */
  inherited?: boolean;
}

/**
 * A member agent of an organization unit.
 * Reputation gating reuses the RDP/CDP `minReputation` semantics.
 */
export interface OrgMember {
  /** W3C DID of the member agent */
  did: string;
  /** Role within the unit, e.g. "lead", "ic", "tool" */
  role: string;
  /** Reputation profile slug */
  slug: string;
  /** Accountability seat type */
  seat?: "accountable" | "contributor" | "tool";
  /** Map of dimension/domain → minimum score threshold (advisory) */
  minReputation?: Record<string, number>;
}

/**
 * What sub-units and recruitment an organization unit is authorized to create.
 */
export interface OrgSpawnAuthority {
  /** Which kinds this unit may create as children */
  canSpawnKinds: OrgKind[];
  /** Cap on direct children (0 or absent = unlimited) */
  maxChildren?: number;
  /** Maximum absolute tree depth (root = 0) at which descendants may be placed */
  maxDepth?: number;
  /** Whether this unit may add member agents without parent approval */
  canRecruit?: boolean;
}

/**
 * Approval / exception routing config for an organization unit.
 * Generalizes CDP's SwarmGovernance.
 */
export interface OrgEscalation {
  /** Explicit DID/user override; if absent, escalation walks the parent chain */
  escalateTo?: string;
  /** Auto-escalate to a human if confidence falls below this threshold (0.0-1.0) */
  confidenceThreshold?: number;
  /** Whether the humanOwner can veto unit decisions */
  vetoPower?: boolean;
  /** If true, any irreversible capability use auto-escalates regardless of requiresApproval */
  autoEscalateIrreversible?: boolean;
}

/**
 * A measurable objective for an organization unit.
 */
export interface OrgKPI {
  /** Metric name, e.g. "tasks-completed", "error-rate" */
  name: string;
  /** Goal value */
  target: number;
  /** Latest measured value (default 0) */
  current?: number;
  /** Unit of measure, e.g. "count", "percent", "ms" */
  unit?: string;
  /** Which direction counts as progress (default: higher-is-better) */
  direction?: "higher-is-better" | "lower-is-better";
}

/**
 * Organization frontmatter (organizations/<slug>.md) — OGP v1.0.
 *
 * A standing coordination unit in a recursive org chart. Units form a tree via
 * `parent`/`children` ID references. Each unit has an accountable agent, a
 * human owner, a capability scope, an optional budget, and an escalation path.
 */
export interface OrganizationFrontmatter extends BaseFrontmatter {
  type: "organization";
  /** OGP protocol version */
  ogp: string;
  /** Unique identifier (org:<slug>) */
  id: string;
  /** Human-readable unit name */
  name: string;
  /** Depth tier of this unit */
  kind: OrgKind;
  /** One-line purpose of the unit */
  mission: string;
  /** Lifecycle state */
  status: "forming" | "active" | "paused" | "dissolved";
  /** Creation timestamp (ISO 8601) */
  created: string;
  /** Parent org:<slug> ID, or null for the root unit */
  parent: string | null;
  /** Child org:<slug> IDs (denormalized for fast reads) */
  children: string[];
  /** DID of the agent accountable for this unit's outcomes ("who owns failure") */
  accountableAgent: string;
  /** User ID of the human ultimately accountable (user:<name>) */
  humanOwner: string;
  /** Member agents with roles and optional reputation gates */
  members: OrgMember[];
  /** Capability scope grants for this unit's agents */
  capabilities: OrgCapability[];
  /** What sub-units/recruitment this unit may create */
  spawnAuthority?: OrgSpawnAuthority;
  /** Token/tool/spend budget */
  budget?: OrgBudget;
  /** Approval / exception routing config */
  escalation?: OrgEscalation;
  /** Measurable objectives for the unit */
  kpis?: OrgKPI[];
  /** Owned CDP project:<slug> IDs (reference, not nesting) */
  projects?: string[];
  /** Owned CDP swarm:<slug> IDs (reference, not nesting) */
  swarms?: string[];
  /** Classification tags */
  tags?: string[];
}
