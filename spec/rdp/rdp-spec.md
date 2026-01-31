# Reputation & Delegation Protocol (RDP) — Specification

**Version:** 1.0
**Status:** Draft
**AWP Version:** 0.3.0
**License:** Apache-2.0

## Abstract

The Reputation & Delegation Protocol (RDP) extends the Agent Workspace Protocol with multi-dimensional reputation tracking and structured delegation contracts. Agents accumulate reputation through signals — atomic observations of behavior — and delegate work through explicit contracts with defined scope, constraints, and evaluation criteria.

RDP operates within a single AWP workspace, tracking the reputations of agents this workspace interacts with and managing delegation contracts between them.

---

## 1. Design Principles

1. **Confidence ≠ Score** — Low data means *unknown*, not *untrustworthy*. A new agent starts with no reputation, not bad reputation.
2. **Decay prevents stagnation** — Scores decrease without fresh signals. No immortal feudal lords.
3. **Domain independence** — An agent's reputation in "ai-research" is independent of "legal-analysis."
4. **Signals over assertions** — Reputation is built from observed behavior, not self-reported claims.
5. **Contracts create accountability** — Delegation is explicit: scope, constraints, evaluation criteria, all defined upfront.
6. **Evaluation generates signals** — Contract completion is the primary source of reputation data.

---

## 2. Reputation Profile

### 2.1 Storage

Reputation profiles are stored as dual-format files (YAML frontmatter + Markdown body) in the `reputation/` directory at the workspace root:

```
reputation/
  research-bot.md
  code-reviewer.md
```

Each file tracks one agent's reputation as observed by this workspace. Files are named by slug (lowercase alphanumeric + hyphens).

### 2.2 Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `awp` | string | YES | AWP version (`"0.3.0"`) |
| `rdp` | string | YES | RDP version (`"1.0"`) |
| `type` | string | YES | Must be `"reputation-profile"` |
| `id` | string | YES | `reputation:<slug>` |
| `agentDid` | string | YES | W3C DID of the tracked agent |
| `agentName` | string | YES | Human-readable name |
| `lastUpdated` | string | YES | ISO 8601 timestamp of last signal |
| `dimensions` | object | NO | Map of dimension name → `ReputationDimension` |
| `domainCompetence` | object | NO | Map of domain name → `DomainScore` |
| `signals` | array | YES | Append-only log of reputation signals |

### 2.3 Reputation Dimensions

Standard dimensions:

| Dimension | Description |
|-----------|-------------|
| `reliability` | Completes tasks, meets constraints, delivers consistent quality |
| `epistemic-hygiene` | Cites sources, calibrates confidence, acknowledges uncertainty |
| `coordination` | Communicates status, handles handoffs, respects defined scope |

Custom dimensions MAY be added. Tools SHOULD recognize the standard three but MUST handle unknown dimension names gracefully.

### 2.4 Dimension Schema

Each dimension (and domain score) has this shape:

| Field | Type | Description |
|-------|------|-------------|
| `score` | number (0.0–1.0) | Current raw score (before decay) |
| `confidence` | number (0.0–1.0) | How much data backs this score |
| `sampleSize` | integer | Number of signals received |
| `lastSignal` | string | ISO 8601 timestamp of most recent signal |

### 2.5 Domain Competence

The `domainCompetence` field is a map of domain slugs to scores. Domains are user-defined strings (e.g., `"ai-research"`, `"frontend-dev"`, `"legal-analysis"`). Each domain has the same shape as a dimension.

Domain competence is separate from standard dimensions because an agent can be reliable across all domains but only competent in specific ones.

---

## 3. Reputation Signals

### 3.1 Signal Format

A signal is an atomic observation of agent behavior:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `source` | string | YES | DID of the observer (who recorded this signal) |
| `dimension` | string | YES | Which dimension or `"domain-competence"` |
| `domain` | string | NO | Required when dimension is `"domain-competence"` |
| `score` | number (0.0–1.0) | YES | Observed performance |
| `timestamp` | string | YES | ISO 8601 when the observation was made |
| `evidence` | string | NO | Reference (e.g., `"contract:q3-research"`, `"artifact:report"`) |
| `message` | string | NO | Human-readable note |

### 3.2 Signal Sources

Signals can originate from:
- **Contract evaluation** — Automated: evaluating a delegation contract generates signals for the delegate.
- **Manual observation** — A human or agent explicitly logs a signal via CLI or MCP.
- **Artifact review** — Reviewing a knowledge artifact and scoring it (future).

### 3.3 Append-Only

The `signals` array is append-only. Signals are NEVER deleted or modified after recording. This ensures a complete audit trail. Consumers filter by dimension, domain, or time range as needed.

---

## 4. Score Computation

### 4.1 EWMA Update

When a new signal arrives for a dimension:

```
decayed_old = applyDecay(dimension.score, dimension.lastSignal, now)
new_score = α × signal.score + (1 - α) × decayed_old
```

Where:
- `α = 0.15` (default learning rate)
- `decayed_old` is the previous score with decay applied up to now

### 4.2 Confidence Computation

```
confidence = 1 - (1 / (1 + sampleSize × 0.1))
```

| Sample Size | Confidence |
|-------------|------------|
| 0 | 0.00 |
| 1 | 0.09 |
| 5 | 0.33 |
| 10 | 0.50 |
| 20 | 0.67 |
| 50 | 0.83 |
| 100 | 0.91 |

Confidence represents data quantity, not score quality. An agent with 100 signals and a 0.3 score has *high confidence* that they perform poorly.

### 4.3 Time-Based Decay

```
decayed_score = raw_score × exp(-decay_rate × months_elapsed)
months_elapsed = (now - lastSignal) / (30.44 × 24 × 60 × 60 × 1000)
decay_rate = 0.02 per month (default)
```

Decay properties:
- Applied **on-read** (lazy evaluation), never stored
- Scores floor at **0.5** (the unknown baseline)
- `floor_adjusted = max(0.5, decayed_score)` when score was above 0.5
- `ceiling_adjusted = min(0.5, decayed_score)` when score was below 0.5
- Effectively: all scores decay toward 0.5 over time

| Months | Decay Factor | 0.95 Score After Decay |
|--------|-------------|----------------------|
| 0 | 1.000 | 0.95 |
| 6 | 0.887 | 0.84 |
| 12 | 0.787 | 0.75 |
| 24 | 0.619 | 0.59 |
| 36 | 0.487 | 0.50 (floor) |

### 4.4 New Agent Baseline

An agent with no signals has no dimensions and no scores. This represents *unknown*, not *untrusted*. Consumers SHOULD treat missing dimensions as "no data" rather than defaulting to a low score.

---

## 5. Delegation Contracts

### 5.1 Storage

Contracts are stored as dual-format files in the `contracts/` directory:

```
contracts/
  q3-research.md
  audit-codebase.md
```

### 5.2 Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `awp` | string | YES | AWP version |
| `rdp` | string | YES | RDP version |
| `type` | string | YES | Must be `"delegation-contract"` |
| `id` | string | YES | `contract:<slug>` |
| `status` | string | YES | One of: `draft`, `active`, `completed`, `evaluated` |
| `delegator` | string | YES | DID of the agent delegating work |
| `delegate` | string | YES | DID of the agent receiving work |
| `delegateSlug` | string | YES | Slug of delegate's reputation profile |
| `created` | string | YES | ISO 8601 creation timestamp |
| `deadline` | string | NO | ISO 8601 deadline |
| `task` | object | YES | Task definition (see 5.3) |
| `scope` | object | NO | Scope constraints (see 5.4) |
| `constraints` | object | NO | Behavioral constraints (see 5.5) |
| `evaluation` | object | YES | Evaluation criteria + results (see 5.6) |

### 5.3 Task Definition

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | YES | What needs to be done |
| `outputFormat` | string | NO | Expected output type (e.g., `"knowledge-artifact"`) |
| `outputSlug` | string | NO | Expected output artifact slug |

### 5.4 Scope

| Field | Type | Description |
|-------|------|-------------|
| `include` | string[] | What's in scope |
| `exclude` | string[] | What's explicitly out of scope |

### 5.5 Constraints

| Field | Type | Description |
|-------|------|-------------|
| `requireCitations` | boolean | Must cite sources |
| `confidenceThreshold` | number | Minimum confidence for claims |

Additional constraint fields MAY be added.

### 5.6 Evaluation

| Field | Type | Description |
|-------|------|-------------|
| `criteria` | object | Map of criterion name → weight (weights should sum to 1.0) |
| `result` | object \| null | Map of criterion name → score (0.0–1.0), null until evaluated |

Standard criteria:

| Criterion | Description |
|-----------|-------------|
| `completeness` | Did the output cover the full scope? |
| `accuracy` | Is the content correct and well-sourced? |
| `clarity` | Is the output clear and well-organized? |
| `timeliness` | Was it delivered on time? |

### 5.7 Contract Lifecycle

```
draft → active → completed → evaluated
```

1. **draft** — Contract created, terms defined. Not yet acknowledged by delegate.
2. **active** — Work in progress. Delegate is working on the task.
3. **completed** — Delegate signals the work is done. Output available for review.
4. **evaluated** — Delegator scores the output against criteria. Reputation signals generated automatically.

### 5.8 Evaluation → Signal Generation

When a contract is evaluated, the system generates reputation signals:

1. **Reliability signal** — Weighted average of all evaluation scores
2. **Domain competence signal** — If `task.outputFormat` is `"knowledge-artifact"`, generates a domain signal using the artifact's tags as the domain

The generated signals reference the contract as evidence.

---

## 6. Validation Rules

### 6.1 Reputation Profile
- `type` MUST be `"reputation-profile"`
- `id` MUST match `reputation:<slug>`
- `agentDid` MUST be a valid DID string
- All dimension scores MUST be in range [0.0, 1.0]
- All confidence values MUST be in range [0.0, 1.0]
- `sampleSize` MUST be a non-negative integer
- `signals` MUST be an array (may be empty)
- Each signal MUST have `source`, `dimension`, `score`, `timestamp`

### 6.2 Delegation Contract
- `type` MUST be `"delegation-contract"`
- `id` MUST match `contract:<slug>`
- `status` MUST be one of: `draft`, `active`, `completed`, `evaluated`
- `delegator` and `delegate` MUST be valid DID strings
- `evaluation.criteria` values SHOULD sum to 1.0
- `evaluation.result` MUST be null until status is `evaluated`
- When status is `evaluated`, `evaluation.result` MUST have scores for all criteria

---

## 7. Security Considerations

- **Self-reporting** — In v1.0, an agent can record signals about itself. This is by design for single-workspace use. Cross-workspace trust requires additional verification (deferred).
- **Signal integrity** — Signals are append-only but not cryptographically signed in v1.0. Git provides integrity via commit history.
- **Privacy** — Reputation profiles may contain sensitive assessments. The `reputation/` directory SHOULD be treated as private workspace data.
- **Decay as defense** — Time-based decay prevents stale high scores from persisting without ongoing evidence.

---

## Appendix A: Examples

### A.1 First Signal for a New Agent

```yaml
---
awp: "0.3.0"
rdp: "1.0"
type: "reputation-profile"
id: "reputation:research-bot"
agentDid: "did:key:zResearchBot123"
agentName: "ResearchBot"
lastUpdated: "2026-02-15T10:30:00Z"
dimensions:
  reliability:
    score: 0.90
    confidence: 0.09
    sampleSize: 1
    lastSignal: "2026-02-15T10:30:00Z"
domainCompetence: {}
signals:
  - source: "did:key:zJarvis"
    dimension: "reliability"
    score: 0.90
    timestamp: "2026-02-15T10:30:00Z"
    message: "Completed first task successfully"
---

# ResearchBot — Reputation Profile

Tracked since 2026-02-15. New agent, limited data.
```

### A.2 Contract Evaluation

```yaml
evaluation:
  criteria:
    completeness: 0.3
    accuracy: 0.4
    clarity: 0.2
    timeliness: 0.1
  result:
    completeness: 0.90
    accuracy: 0.85
    clarity: 0.80
    timeliness: 1.00
```

Weighted score: `0.3×0.90 + 0.4×0.85 + 0.2×0.80 + 0.1×1.00 = 0.87`

Generated reliability signal: `score: 0.87`
