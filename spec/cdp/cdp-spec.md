# Coordination Protocol (CDP) — Specification

**Version:** 1.0
**Status:** Draft
**AWP Version:** 0.4.0
**License:** Apache-2.0

## Abstract

The Coordination Protocol (CDP) extends the Agent Workspace Protocol with structured projects, tasks, and reputation-gated role assignments. Agents organize work into projects, decompose projects into tasks with dependencies and priorities, and use reputation data to inform assignment decisions.

CDP operates within a single AWP workspace. Projects and tasks are file-based, dual-format (YAML frontmatter + Markdown body), and version-controlled by default.

---

## 1. Design Principles

1. **Files over databases** — Projects and tasks are markdown files. No server, no runtime state.
2. **Reputation closes the loop** — Role assignments can require minimum reputation scores. This is the first consumer of RDP data.
3. **Dependencies are informational** — `blockedBy` and `blocks` fields exist for visibility. Enforcement and graph traversal are deferred.
4. **Warn, don't block** — Reputation gates produce warnings, not hard failures. Humans decide.
5. **Nesting where ownership exists** — Tasks live under their project directory because they don't exist independently.
6. **Counts are denormalized** — `taskCount` and `completedCount` on projects are updated on task mutations for fast reads.

---

## 2. Projects

### 2.1 Storage

Projects are stored as dual-format files in the `projects/` directory at the workspace root:

```
projects/
  q3-product-launch.md
  code-audit.md
```

Each file describes one project. Files are named by slug (lowercase alphanumeric + hyphens).

### 2.2 Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `awp` | string | YES | AWP version (`"0.4.0"`) |
| `cdp` | string | YES | CDP version (`"1.0"`) |
| `type` | string | YES | Must be `"project"` |
| `id` | string | YES | `project:<slug>` |
| `title` | string | YES | Human-readable project title |
| `status` | string | YES | Lifecycle state (see 2.3) |
| `owner` | string | YES | DID of the project owner |
| `created` | string | YES | ISO 8601 creation timestamp |
| `deadline` | string | NO | ISO 8601 deadline |
| `members` | array | YES | List of project members (see 2.4) |
| `tags` | string[] | NO | Classification tags |
| `taskCount` | integer | YES | Total number of tasks |
| `completedCount` | integer | YES | Number of completed tasks |

### 2.3 Project Lifecycle

```
draft → active → paused → completed → archived
```

- **draft** — Project defined but not yet started.
- **active** — Work in progress. Tasks are being assigned and executed.
- **paused** — Temporarily halted. No active work expected.
- **completed** — All objectives met. May still have incomplete tasks.
- **archived** — Historical record. No further changes expected.

### 2.4 Members

Each member has:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `did` | string | YES | W3C DID of the member agent |
| `role` | string | YES | Role name (e.g., `"lead"`, `"researcher"`, `"writer"`) |
| `slug` | string | YES | Reputation profile slug for this agent |
| `minReputation` | object | NO | Map of dimension/domain → minimum score (see 2.5) |

### 2.5 Reputation Gates

The `minReputation` field is a map where keys are reputation dimension names (or `domain-competence:<domain>` for domain-specific gates) and values are minimum scores (0.0–1.0).

When a task is assigned to an agent, the system:
1. Looks up the agent's reputation profile by `slug`
2. Finds their role in the project's `members` array
3. For each gate in `minReputation`, checks the agent's decayed score
4. Produces warnings for any scores below the threshold

Gates are **advisory only**. The assignment proceeds regardless. This matches the AWP philosophy of human governance — the system informs, humans decide.

Example:

```yaml
members:
  - did: "did:key:zResearchBot"
    role: "researcher"
    slug: "research-bot"
    minReputation:
      reliability: 0.6
      domain-competence:ai-research: 0.7
```

---

## 3. Tasks

### 3.1 Storage

Tasks are stored as dual-format files nested under their project:

```
projects/
  q3-product-launch.md
  q3-product-launch/
    tasks/
      competitive-analysis.md
      positioning-doc.md
```

This is AWP's first nested storage pattern. Tasks are owned by a project and cannot exist independently. The `tasks/` subdirectory is created automatically when the first task is added.

### 3.2 Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `awp` | string | YES | AWP version |
| `cdp` | string | YES | CDP version |
| `type` | string | YES | Must be `"task"` |
| `id` | string | YES | `task:<project-slug>/<task-slug>` |
| `projectId` | string | YES | Parent project ID (`project:<slug>`) |
| `title` | string | YES | Human-readable task title |
| `status` | string | YES | Task state (see 3.3) |
| `assignee` | string | NO | DID of the assigned agent |
| `assigneeSlug` | string | NO | Reputation profile slug of the assignee |
| `priority` | string | YES | `low`, `medium`, `high`, or `critical` |
| `created` | string | YES | ISO 8601 creation timestamp |
| `deadline` | string | NO | ISO 8601 deadline |
| `blockedBy` | string[] | YES | Task IDs this task depends on |
| `blocks` | string[] | YES | Task IDs that depend on this task |
| `outputArtifact` | string | NO | Expected output artifact slug |
| `contractSlug` | string | NO | Linked delegation contract slug |
| `tags` | string[] | NO | Classification tags |

### 3.3 Task States

```
pending → in-progress → blocked → review → completed → cancelled
```

- **pending** — Created, not yet started.
- **in-progress** — Actively being worked on.
- **blocked** — Cannot proceed; waiting on dependencies.
- **review** — Work done, awaiting review or approval.
- **completed** — Done. Output (if any) delivered.
- **cancelled** — Will not be completed.

### 3.4 Dependencies

The `blockedBy` and `blocks` fields express task dependencies:
- `blockedBy` — "I cannot start until these tasks are done"
- `blocks` — "These tasks are waiting on me"

In CDP v1.0, dependencies are **informational**:
- The CLI displays them and warns when relevant (e.g., completing a task that blocks others)
- No automatic state transitions (a task does not auto-move to `blocked` when its dependency is incomplete)
- No topological sort or cycle detection

Dependency graph features are deferred to CDP v2.0.

### 3.5 Links to Other AWP Entities

Tasks can reference:
- **Artifacts** via `outputArtifact` — the expected output of this task
- **Contracts** via `contractSlug` — the delegation contract governing this task
- **Reputation** via `assigneeSlug` — the assignee's reputation profile

These are slug references, not enforced foreign keys. `awp validate` can optionally check that referenced entities exist.

---

## 4. Authority Merge Strategy

### 4.1 Background

SMP (Phase 2) introduced artifact merging with an `additive` strategy — source content is appended to the target. This works for research aggregation but not for conflicting claims.

CDP adds the `authority` merge strategy, using RDP reputation data to resolve conflicts.

### 4.2 Algorithm

Given target artifact `T` and source artifact `S`:

1. Identify a shared domain: find a tag present in both artifacts' `tags` arrays. If none, fall back to `additive` merge.
2. Identify primary authors: the most recent provenance entry for each artifact.
3. Look up domain reputation: query `domainCompetence[shared_tag]` for each author's reputation profile, applying time-based decay.
4. Determine authority: the author with the higher decayed domain score is the "authority."
5. Merge content:
   - Authority's content is placed first (preserved as-is)
   - Non-authority content is appended under a heading: `## Additional Context (from <agent-name>)`
   - If scores are equal (or both missing), fall back to additive merge
6. Update provenance: record the merge with `strategy: "authority"` and the scores that determined the outcome.

### 4.3 CLI Usage

```bash
awp artifact merge <target> <source> --strategy authority
```

The `--strategy` flag defaults to `additive` (preserving backward compatibility).

### 4.4 Provenance Entry

```yaml
provenance:
  - agent: "did:key:zMerger"
    action: "merged"
    timestamp: "2026-02-20T10:00:00Z"
    message: "Authority merge: research-bot (0.91) > writer (0.45) on ai-research"
    strategy: "authority"
```

---

## 5. Validation Rules

### 5.1 Projects
- `type` MUST be `"project"`
- `id` MUST match `project:<slug>`
- `status` MUST be one of: `draft`, `active`, `paused`, `completed`, `archived`
- `owner` MUST be a valid DID string
- `members` MUST be a non-empty array
- Each member MUST have `did`, `role`, and `slug`
- `taskCount` and `completedCount` MUST be non-negative integers
- `completedCount` MUST NOT exceed `taskCount`

### 5.2 Tasks
- `type` MUST be `"task"`
- `id` MUST match `task:<project-slug>/<task-slug>`
- `projectId` MUST match `project:<project-slug>`
- `status` MUST be one of: `pending`, `in-progress`, `blocked`, `review`, `completed`, `cancelled`
- `priority` MUST be one of: `low`, `medium`, `high`, `critical`
- `blockedBy` and `blocks` MUST be arrays (may be empty)
- If `assignee` is set, `assigneeSlug` SHOULD also be set

### 5.3 Cross-Reference Integrity (optional)
Validators MAY check:
- `contractSlug` references an existing contract
- `outputArtifact` references an existing artifact
- `assigneeSlug` references an existing reputation profile
- `blockedBy` IDs reference tasks within the same project

---

## 6. Security Considerations

- **Task assignment** — Any agent with workspace write access can assign tasks. In single-workspace mode, this is by design. Multi-workspace governance is deferred.
- **Reputation gate bypass** — Gates are advisory only. A malicious agent could assign itself tasks despite low reputation. The audit trail (git history) captures this.
- **Denormalized counts** — `taskCount` and `completedCount` can become stale if files are edited manually. `awp validate` can detect mismatches.
- **Nested directories** — The `projects/<slug>/tasks/` pattern creates deeper directory structures. Tools MUST handle this gracefully.

---

## Appendix A: Examples

### A.1 Simple Project with Two Tasks

```yaml
---
awp: "0.4.0"
cdp: "1.0"
type: "project"
id: "project:api-redesign"
title: "API Redesign"
status: "active"
owner: "did:key:zJarvis"
created: "2026-02-01T00:00:00Z"
deadline: "2026-03-01T00:00:00Z"
members:
  - did: "did:key:zJarvis"
    role: "lead"
    slug: "jarvis"
  - did: "did:key:zCoder"
    role: "developer"
    slug: "coder"
    minReputation:
      reliability: 0.7
tags: ["engineering"]
taskCount: 2
completedCount: 0
---

# API Redesign

Redesign the REST API to support pagination and filtering.
```

### A.2 Task with Dependencies

```yaml
---
awp: "0.4.0"
cdp: "1.0"
type: "task"
id: "task:api-redesign/implement-pagination"
projectId: "project:api-redesign"
title: "Implement Pagination"
status: "blocked"
assignee: "did:key:zCoder"
assigneeSlug: "coder"
priority: "high"
created: "2026-02-01T10:00:00Z"
blockedBy: ["task:api-redesign/design-schema"]
blocks: []
tags: ["backend"]
---

# Implement Pagination

Add cursor-based pagination to all list endpoints.

## Acceptance Criteria
- All /list endpoints support `cursor` and `limit` params
- Default limit: 20, max: 100
- Response includes `nextCursor` field
```

### A.3 Authority Merge Result

```yaml
provenance:
  - agent: "did:key:zJarvis"
    action: "merged"
    timestamp: "2026-02-20T10:00:00Z"
    message: "Authority merge from source-slug: research-bot (0.91) > writer (0.45) on ai-research"
    strategy: "authority"
```
