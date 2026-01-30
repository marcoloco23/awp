# Shared Memory Protocol (SMP) Specification

**Version:** 1.0 (Draft)
**AWP Version:** 0.2.0
**Status:** Working Draft
**License:** Apache-2.0

## Abstract

The Shared Memory Protocol (SMP) extends AWP with **knowledge artifacts** — versioned, provenanced, confidence-scored documents that represent an agent's accumulated knowledge. SMP provides git-like semantics for agent knowledge: create, version, search, and merge.

SMP builds on AWP's dual-format convention (YAML frontmatter + Markdown body) and file-native storage model. Knowledge artifacts live alongside memory logs in the workspace, providing a structured layer above raw session logs.

## 1. Knowledge Artifacts

A knowledge artifact is a versioned document representing a discrete unit of agent knowledge — research findings, design decisions, learned patterns, domain expertise, or any structured insight worth preserving beyond a daily log.

### 1.1 Artifact vs Memory

| | Daily Memory | Long-term Memory | Knowledge Artifact |
|---|---|---|---|
| **Purpose** | Session journal | Curated reference | Versioned knowledge |
| **Granularity** | Timestamped entries | Distilled insights | Complete documents |
| **Versioning** | None (append-only) | None (overwrite) | Monotonic version counter + provenance |
| **Provenance** | None | None | Full audit trail (who, what, when) |
| **Confidence** | None | None | 0.0 - 1.0 score |
| **Searchable** | By date, tags, content | By content | By title, tags, content, metadata |
| **Merge** | N/A | Manual | Additive merge with attribution |

### 1.2 When to Use Artifacts

Use knowledge artifacts when:
- Knowledge will be referenced across multiple sessions
- Multiple agents may contribute to or consume the knowledge
- Provenance matters (who discovered what, when)
- Confidence tracking matters (how reliable is this knowledge?)
- The knowledge is a coherent document, not a log entry

Continue using daily memory for session logs. Continue using long-term memory for distilled personal reference.

## 2. Format

### 2.1 Frontmatter Schema

```yaml
---
awp: "0.2.0"
smp: "1.0"
type: "knowledge-artifact"
id: "artifact:<slug>"
title: "Human-Readable Title"
authors:
  - "did:key:zAgent1"
version: 1
confidence: 0.85
tags:
  - "domain-tag"
created: "2026-01-30T00:00:00Z"
lastModified: "2026-01-30T00:00:00Z"
modifiedBy: "did:key:zAgent1"
provenance:
  - agent: "did:key:zAgent1"
    action: "created"
    timestamp: "2026-01-30T00:00:00Z"
    message: "Initial research findings"
---
```

### 2.2 Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `awp` | string | AWP specification version |
| `smp` | string | SMP protocol version (e.g., `"1.0"`) |
| `type` | string | Must be `"knowledge-artifact"` |
| `id` | string | Artifact identifier (format: `artifact:<slug>`) |
| `title` | string | Human-readable title |
| `authors` | string[] | DIDs of contributing agents (minimum 1) |
| `version` | integer | Monotonically increasing, starts at 1 |
| `created` | string | ISO 8601 creation timestamp |
| `provenance` | array | Append-only audit log (minimum 1 entry) |

### 2.3 Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `confidence` | number | Agent confidence score (0.0 - 1.0) |
| `tags` | string[] | Categorization tags for search and filtering |
| `lastModified` | string | ISO 8601 timestamp of last modification |
| `modifiedBy` | string | DID of last modifier |

### 2.4 Identifier Scheme

Artifact IDs follow the format `artifact:<slug>` where:
- `<slug>` is a URL-safe string matching `^[a-z0-9][a-z0-9-]*$`
- The slug doubles as the filename: `artifacts/<slug>.md`
- Slugs MUST be unique within a workspace

Examples: `artifact:llm-context-research`, `artifact:api-design-patterns`, `artifact:auth-service-analysis`

### 2.5 Versioning

- `version` is a monotonically increasing integer starting at 1
- Every mutation (update or merge) increments the version by 1
- The version counter is local to the artifact (not global)
- Previous versions are recoverable via git history
- The `provenance` array provides a human-readable audit trail without requiring git access

### 2.6 Provenance

Each entry in the `provenance` array records a single mutation:

```yaml
provenance:
  - agent: "did:key:zAgent1"    # DID of the acting agent
    action: "created"            # What happened
    timestamp: "2026-01-30T..."  # When it happened
    message: "Initial findings"  # Optional commit message
    confidence: 0.85             # Optional confidence at time of action
```

**Actions:**
- `created` — artifact was created (first entry only)
- `updated` — content was modified
- `merged` — content from another artifact was incorporated

Provenance entries are **append-only**. They MUST NOT be modified or deleted.

### 2.7 Confidence Scores

Confidence is a number between 0.0 and 1.0 representing the agent's epistemic confidence in the artifact's accuracy and completeness.

Guidelines:
- `0.9 - 1.0` — Well-established, verified knowledge
- `0.7 - 0.9` — Confident, based on strong evidence
- `0.5 - 0.7` — Moderate confidence, some uncertainty
- `0.3 - 0.5` — Speculative, needs verification
- `0.0 - 0.3` — Preliminary, low confidence

Confidence MAY change with each update. When it changes, the new value SHOULD be recorded in the provenance entry.

### 2.8 Markdown Body

The markdown body below the frontmatter contains the actual knowledge content. It is free-form Markdown and represents the current version of the artifact's content. The body is the primary content; the frontmatter is metadata about that content.

## 3. Storage

### 3.1 Directory Layout

Artifacts are stored in the `artifacts/` directory at the workspace root:

```
<workspace-root>/
  artifacts/
    llm-context-research.md
    api-design-patterns.md
    auth-service-analysis.md
```

### 3.2 File Naming

The filename is derived from the artifact slug: `artifacts/<slug>.md`. The slug is extracted from the `id` field by removing the `artifact:` prefix.

### 3.3 Directory Creation

The `artifacts/` directory is created on-demand when the first artifact is created, or during `awp init`.

## 4. Operations

### 4.1 Create

Creates a new artifact with version 1 and an initial provenance entry.

**Preconditions:**
- The slug must be valid (matches `^[a-z0-9][a-z0-9-]*$`)
- No artifact with the same slug exists

**Behavior:**
1. Create `artifacts/<slug>.md`
2. Set `version: 1`
3. Set `created` and `lastModified` to current timestamp
4. Initialize `provenance` with a `created` entry
5. Set `authors` to the current agent's DID

### 4.2 Commit (Update)

Records a new version of an existing artifact.

**Preconditions:**
- The artifact must exist
- Content changes should be made before committing

**Behavior:**
1. Increment `version` by 1
2. Update `lastModified` and `modifiedBy`
3. Append an `updated` entry to `provenance`
4. If confidence is provided, update the top-level `confidence`

Note: The commit operation records metadata about a change. The actual content edits to the markdown body are made separately (by the agent or human) before running commit.

### 4.3 Read

Reads an artifact by slug, returning frontmatter and body.

### 4.4 List

Lists all artifacts in the workspace, optionally filtered by tag.

### 4.5 Search

Searches artifacts by matching against title, tags, and body content (case-insensitive).

### 4.6 Merge (Additive)

Combines content from a source artifact into a target artifact.

**SMP 1.0 supports additive merge only.** This concatenates the source content into the target with clear attribution.

**Behavior:**
1. Append source body to target body with a merge separator
2. Union the `authors` arrays (deduplicate)
3. Union the `tags` arrays (deduplicate)
4. Increment target `version`
5. Set confidence to the minimum of both artifacts (conservative)
6. Append a `merged` provenance entry
7. Source artifact is NOT modified or deleted

**Merge separator format:**
```markdown
---
*Merged from artifact:<source-slug> (version N) on <timestamp>*

<source body content>
```

### 4.7 Future Merge Strategies (Informational)

The following strategies are planned for future SMP versions:
- **Authority merge** — Agent with higher domain reputation wins on conflicts
- **Consensus merge** — N agents must agree before claims are promoted
- **Human escalation** — Flag for human decision when automated strategies cannot resolve

These strategies require the Reputation & Delegation Protocol (RDP, Phase 3) and are not implemented in SMP 1.0.

## 5. Interoperability

### 5.1 MCP Tool Mapping

| MCP Tool | SMP Operation |
|----------|---------------|
| `awp_artifact_read` | Read |
| `awp_artifact_write` | Create or Update (combined) |
| `awp_artifact_list` | List |
| `awp_artifact_search` | Search |

### 5.2 CLI Command Mapping

| CLI Command | SMP Operation |
|-------------|---------------|
| `awp artifact create <slug>` | Create |
| `awp artifact commit <slug>` | Commit |
| `awp artifact log <slug>` | Read provenance |
| `awp artifact list` | List |
| `awp artifact search <query>` | Search |
| `awp artifact merge <target> <source>` | Merge |

## 6. Validation

A valid knowledge artifact MUST:
1. Have all required frontmatter fields (awp, smp, type, id, title, authors, version, created, provenance)
2. Have `type` set to `"knowledge-artifact"`
3. Have `id` matching the pattern `artifact:<slug>` where slug matches `^[a-z0-9][a-z0-9-]*$`
4. Have `version` >= 1
5. Have at least one entry in `authors`
6. Have at least one entry in `provenance`
7. Have `confidence` between 0.0 and 1.0 (if present)
8. Have the first provenance entry with action `"created"`

## 7. Security Considerations

- **No access control in SMP 1.0**: All artifacts in a workspace are readable/writable by any agent with workspace access. Access control is deferred to a future version.
- **No concurrent write protection**: If multiple agents write to the same artifact simultaneously, last-writer-wins. Single-agent workspaces are the assumed model for SMP 1.0.
- **Provenance is not cryptographically verified**: Provenance entries are self-reported by agents. Signed provenance (using AWP DID signatures) is a future enhancement.
- **Anonymous agents**: If no DID is configured, `"anonymous"` is used as the agent identifier in provenance entries.

## Appendix A: JSON Schema

The JSON Schema for knowledge artifact frontmatter is at `schemas/knowledge-artifact.schema.json`.

## Appendix B: Examples

### Minimal Artifact

```yaml
---
awp: "0.2.0"
smp: "1.0"
type: "knowledge-artifact"
id: "artifact:quick-note"
title: "Quick Note"
authors: ["anonymous"]
version: 1
created: "2026-01-30T10:00:00Z"
provenance:
  - agent: "anonymous"
    action: "created"
    timestamp: "2026-01-30T10:00:00Z"
---

# Quick Note

Some knowledge worth preserving.
```

### Research Artifact with Provenance

```yaml
---
awp: "0.2.0"
smp: "1.0"
type: "knowledge-artifact"
id: "artifact:llm-context-research"
title: "LLM Context Window Research"
authors:
  - "did:key:z6MkAgent1"
  - "did:key:z6MkAgent2"
version: 4
confidence: 0.82
tags:
  - "ai-research"
  - "context-windows"
  - "benchmarks"
created: "2026-02-01T09:00:00Z"
lastModified: "2026-02-05T14:30:00Z"
modifiedBy: "did:key:z6MkAgent2"
provenance:
  - agent: "did:key:z6MkAgent1"
    action: "created"
    timestamp: "2026-02-01T09:00:00Z"
    message: "Initial literature review"
    confidence: 0.6
  - agent: "did:key:z6MkAgent1"
    action: "updated"
    timestamp: "2026-02-02T11:00:00Z"
    message: "Added benchmark comparison table"
    confidence: 0.75
  - agent: "did:key:z6MkAgent2"
    action: "merged"
    timestamp: "2026-02-04T16:00:00Z"
    message: "Incorporated findings from artifact:transformer-analysis"
    confidence: 0.80
  - agent: "did:key:z6MkAgent2"
    action: "updated"
    timestamp: "2026-02-05T14:30:00Z"
    message: "Corrected citation and updated confidence"
    confidence: 0.82
---

# LLM Context Window Research

## Summary

Analysis of context window capabilities across major LLM providers...
```
