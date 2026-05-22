# Organization Protocol (OGP) — Specification

**Version:** 1.0
**Status:** Draft
**AWP Version:** 0.4.0
**License:** Apache-2.0

## Abstract

The Organization Protocol (OGP) extends the Agent Workspace Protocol with
**recursive machine organizations** — a tree of standing coordination units
(`org` → `division` → `team`) in which agents are organized into accountable
groups rather than treated as isolated workers.

Where CDP's primitives (projects, tasks, swarms) are *transient work
containers* — bounded, goal-scoped, disbanded on completion — an OGP
organization is a *standing* unit with its own lifecycle, accountability,
capability scope, budget, and escalation path. OGP answers the governance
questions that hierarchy raises: who may spawn whom, who pays for resource
use, what a unit is allowed to do, which actions are irreversible, who owns
failure, and how exceptions escalate to a human.

OGP operates within a single AWP workspace. Organizations are file-based,
dual-format (YAML frontmatter + Markdown body), and version-controlled by
default. OGP *consumes* RDP reputation and *references* CDP projects and
swarms, exactly as CDP consumed RDP.

---

## 1. Design Principles

1. **Files over databases** — Organizations are markdown files. No server, no
   runtime state.
2. **The chart is a tree of references** — The org tree is expressed by
   `parent`/`children` ID references, not directory nesting, so a unit can be
   re-parented without moving files.
3. **Accountability is structural** — Every unit names an `accountableAgent`
   (the agent who owns the unit's outcomes) and a `humanOwner` (the human
   ultimately accountable). "Who owns failure" is a required field.
4. **Capabilities flow down; consumption rolls up** — A unit's effective
   capabilities are its own grants plus every ancestor's. Budget consumption
   is summed from a unit and all its descendants.
5. **Irreversible actions are gated** — A capability marked `irreversible`
   MUST also be marked `requiresApproval`. Escalation walks *up* the tree to a
   human.
6. **Warn, don't block** — Spawn-authority checks, budget rollups, and
   reputation gates produce advisory signals, not hard failures. Humans
   decide. (OGP v1.0 records governance data; runtime enforcement is deferred
   — see §7.)
7. **Counts are denormalized** — `children` is maintained on each unit for
   fast reads; `parent` is authoritative and drift is detected by validation.

---

## 2. Organizations

### 2.1 Storage

Organizations are stored as dual-format files in the `organizations/`
directory at the workspace root:

```
organizations/
  acme.md
  engineering.md
  platform-team.md
```

Each file describes one unit. Files are named by slug (lowercase
alphanumeric + hyphens). The tree is flat on disk — hierarchy is expressed by
the `parent` field, not by nesting.

### 2.2 Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `awp` | string | YES | AWP version |
| `ogp` | string | YES | OGP version (`"1.0"`) |
| `type` | string | YES | Must be `"organization"` |
| `id` | string | YES | `org:<slug>` |
| `name` | string | YES | Human-readable unit name |
| `kind` | string | YES | `org`, `division`, or `team` (see 2.4) |
| `mission` | string | YES | One-line purpose of the unit |
| `status` | string | YES | Lifecycle state (see 2.3) |
| `created` | string | YES | ISO 8601 creation timestamp |
| `parent` | string \| null | YES | Parent `org:<slug>` ID, or `null` for the root |
| `children` | string[] | YES | Child `org:<slug>` IDs (denormalized) |
| `accountableAgent` | string | YES | DID of the agent who owns this unit's outcomes |
| `humanOwner` | string | YES | User ID of the human ultimately accountable |
| `members` | OrgMember[] | YES | Member agents (may be empty) |
| `capabilities` | Capability[] | YES | Capability scope (may be empty) |
| `spawnAuthority` | object | NO | What sub-units/recruitment this unit may create (see 3) |
| `budget` | object | NO | Token/tool/spend budget (see 4) |
| `escalation` | object | NO | Approval / exception routing (see 5) |
| `kpis` | KPI[] | NO | Measurable objectives |
| `projects` | string[] | NO | Owned CDP `project:<slug>` IDs |
| `swarms` | string[] | NO | Owned CDP `swarm:<slug>` IDs |
| `tags` | string[] | NO | Classification tags |

### 2.3 Organization Lifecycle

```
forming → active → paused → dissolved
```

- **forming** — Unit defined; members and capabilities still being assembled.
- **active** — Operating.
- **paused** — Temporarily halted.
- **dissolved** — Stood down. The file is kept as a historical record; OGP
  does not delete dissolved units.

### 2.4 Unit Kinds

`kind` is the depth tier of a unit. Tiers descend `org` > `division` > `team`.
A unit MUST be a lower tier than its parent (validated as a warning). There is
no fixed depth — `division` may contain `division`-tier sub-units if a design
calls for it — but the canonical chart is `org` → `division` → `team`.

### 2.5 Members

Each member has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `did` | string | YES | W3C DID of the member agent |
| `role` | string | YES | Role within the unit (e.g. `lead`, `ic`, `tool`) |
| `slug` | string | YES | Reputation profile slug |
| `seat` | string | NO | `accountable`, `contributor`, or `tool` |
| `minReputation` | object | NO | Advisory reputation gate (see 2.6) |

### 2.6 Reputation Gates

`minReputation` is a map of reputation dimension names (or
`domain-competence:<domain>`) to minimum decayed scores (0.0–1.0). It reuses
RDP semantics verbatim — identical to `ProjectMember.minReputation`. Gates are
**advisory only**: tooling surfaces warnings when a member's decayed score
falls below a threshold, but membership is never blocked.

---

## 3. Spawn Authority

`spawnAuthority` declares what a unit is permitted to create:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `canSpawnKinds` | string[] | YES | Kinds this unit may create as children |
| `maxChildren` | integer | NO | Cap on direct children (0/absent = unlimited) |
| `maxDepth` | integer | NO | Maximum absolute tree depth (root = 0) for descendants |
| `canRecruit` | boolean | NO | Whether this unit may add members without parent approval |

A spawn is permitted when the parent has `spawnAuthority`, the child `kind` is
in `canSpawnKinds`, the child is a lower tier than the parent, the
`maxChildren` cap is not exceeded, and the child's depth does not exceed
`maxDepth`. `canRecruitMember` falls back to the parent's authority when a
unit does not itself grant `canRecruit`.

In OGP v1.0 spawn-authority checks are advisory — tooling reports a failed
check and proceeds. The audit trail (git history) records who created what.

---

## 4. Budgets

`budget` accounts for resource use:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `currency` | string | NO | e.g. `USD`, `tokens` (default `tokens`) |
| `allocation` | BudgetLine | YES | What this unit is granted |
| `consumption` | BudgetLine | YES | What this unit alone has consumed |
| `period` | string | NO | `one-time`, `daily`, or `monthly` |

A **BudgetLine** is `{ tokens?, toolCalls?, spend? }`; all fields are
non-negative numbers, all optional.

`consumption` records the **owning unit's usage only**. The subtree total — a
unit's own consumption plus every descendant's own consumption — is *computed*
(`rollupBudget`), never stored. A unit is **over budget** when its subtree
consumption exceeds its allocation on any line. Lines with no allocation are
treated as unlimited.

In OGP v1.0 budgets are accounting records. There is no live cost meter and no
tool call is blocked when a unit is over budget — see §7.

---

## 5. Escalation

`escalation` routes approvals and exceptions:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `escalateTo` | string | NO | Explicit DID/user override; absent = walk the parent chain |
| `confidenceThreshold` | number | NO | Auto-escalate below this confidence (0.0–1.0) |
| `vetoPower` | boolean | NO | Whether `humanOwner` can veto unit decisions |
| `autoEscalateIrreversible` | boolean | NO | If true, irreversible capability use always escalates |

`confidenceThreshold` and `vetoPower` reuse CDP `SwarmGovernance` semantics.

The **escalation path** of a unit is the ordered chain from the unit itself up
toward the root. A unit that sets `escalateTo` short-circuits the chain at
that step. The **approver** for a unit's irreversible actions is its own
`escalateTo` if set, otherwise its `humanOwner`. Because `humanOwner` is a
required field on every unit, every unit always resolves to an accountable
human.

---

## 6. Capabilities

A capability is an action a unit's agents are permitted to perform:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | YES | Identifier, e.g. `read:artifacts`, `email:client`, `deploy:production` |
| `description` | string | NO | Human-readable explanation |
| `irreversible` | boolean | YES | True for actions that cannot be undone |
| `requiresApproval` | boolean | YES | True if a human must approve each use |
| `approver` | string | NO | User ID who approves; defaults to the resolved escalation target |
| `inherited` | boolean | NO | Set by capability resolution when the grant came from an ancestor |

**Invariant:** if `irreversible` is `true`, `requiresApproval` MUST be `true`.
Tooling enforces this — the CLI elevates `requiresApproval`, the MCP server
rejects a contradictory grant.

### 6.1 Capability Inheritance

A unit's **effective capabilities** are its own grants plus every ancestor's
grants, deduped by `name`. On a name collision the **nearest** unit wins
(self, then closest ancestor). Inherited entries are flagged `inherited: true`
with the granting unit recorded as the source. Capabilities therefore flow
*down* the tree: granting `deploy:production` at the root makes it available
(and gated) for every descendant.

---

## 7. Deferred to Future Versions

OGP v1.0 establishes the data model and tooling. The following are
intentionally **out of scope** for v1.0 and tracked for later:

- **Runtime capability enforcement** — the experiment orchestrator does not
  consult capability scopes at execution time; gates are advisory.
- **Budget enforcement at execution time** — no live cost meter; no tool call
  is blocked when over budget.
- **Re-parenting automation** — no `awp org move`; `parent`/`children` drift
  is detected, not auto-healed.
- **Cross-workspace / federated organizations** — single-workspace only.
- **KPI auto-measurement** — KPIs are authored and updated manually.
- **Approval-request inbox** — OGP records *who* approves and *when* approval
  is required, but does not define an approval-queue file type.

---

## 8. Validation Rules

### 8.1 Schema (per file)
- `type` MUST be `"organization"`
- `id` MUST match `org:<slug>`
- `kind` MUST be one of `org`, `division`, `team`
- `status` MUST be one of `forming`, `active`, `paused`, `dissolved`
- `parent` MUST be a string or `null`
- `children`, `members`, `capabilities` MUST be arrays (may be empty)
- Each capability MUST have `name`, `irreversible`, `requiresApproval`

### 8.2 Structural (across the chart)
- Exactly **one root** (a unit with `parent: null`) — error otherwise
- Every `parent` and every `children[]` entry MUST resolve to an existing unit
- `parent`/`children` MUST be consistent — drift is a warning (denormalized)
- The parent graph MUST be acyclic — a cycle is an error
- A capability with `irreversible: true` MUST have `requiresApproval: true` —
  error otherwise
- A unit's `kind` SHOULD be a lower tier than its parent's — warning otherwise
- `accountableAgent` SHOULD be one of the unit's `members` — warning otherwise

---

## 9. Security Considerations

- **Advisory gates** — Spawn authority, budgets, and reputation gates inform
  but do not enforce in v1.0. A workspace with write access can create any
  unit. The git history is the audit trail.
- **Denormalized `children`** — Can drift if files are edited by hand.
  `awp org validate` detects mismatches.
- **Capability scope is not a sandbox** — A capability grant is a declaration
  of intent and an input to human approval, not a runtime permission boundary.
  Treat irreversible capabilities as requiring out-of-band human sign-off.

---

## Appendix A: Example — A Three-Tier Organization

```yaml
---
awp: "0.4.0"
ogp: "1.0"
type: "organization"
id: "org:acme"
name: "Acme"
kind: "org"
mission: "Ship reliable software with a small leveraged team"
status: "active"
created: "2026-05-22T00:00:00Z"
parent: null
children: ["org:engineering"]
accountableAgent: "did:key:zCeoAgent"
humanOwner: "user:marc"
members:
  - did: "did:key:zCeoAgent"
    role: "lead"
    slug: "ceo-agent"
    seat: "accountable"
capabilities:
  - name: "deploy:production"
    description: "Release to the production environment"
    irreversible: true
    requiresApproval: true
spawnAuthority:
  canSpawnKinds: ["division"]
  maxDepth: 3
  canRecruit: true
budget:
  currency: "tokens"
  allocation: { tokens: 1000000 }
  consumption: { tokens: 0 }
  period: "monthly"
escalation:
  vetoPower: true
  autoEscalateIrreversible: true
kpis:
  - name: "release-defect-rate"
    target: 0.02
    current: 0.03
    direction: "lower-is-better"
---

# Acme

Ship reliable software with a small leveraged team.
```

A `team`-tier unit three levels down inherits `deploy:production` from
`org:acme` (flagged `inherited: true`), and its escalation path resolves up
through `org:engineering` to `org:acme`, terminating at `user:marc`.

## Appendix B: Resolved Concepts

| Concept | Resolution rule |
|---------|-----------------|
| Effective capabilities | Own grants + ancestors', nearest unit wins on name collision |
| Subtree budget consumption | Unit's own consumption + every descendant's own consumption |
| Over budget | Subtree consumption exceeds allocation on any line |
| Escalation path | Unit → … → root, short-circuited by `escalateTo` |
| Approver | Unit's `escalateTo`, else its `humanOwner` |
| Spawn permitted | `spawnAuthority` present ∧ kind allowed ∧ lower tier ∧ within `maxChildren`/`maxDepth` |
