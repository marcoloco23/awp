# Agent Workspace Protocol (AWP) Specification

**Version:** 0.1.0 (Draft)
**Status:** Working Draft
**License:** Apache-2.0

## Abstract

The Agent Workspace Protocol (AWP) defines a portable, framework-agnostic format for representing an AI agent's persistent state — its identity, behavioral constraints, memory, relationships, and operational context. AWP workspaces are human-readable directories of Markdown files with structured YAML frontmatter, designed to be version-controlled and composable.

AWP sits below communication protocols (A2A), tool protocols (MCP), and payment protocols (ACK). It defines what the agent *is*, while those protocols define what the agent *does*.

## 1. Design Principles

1. **Dual-format**: Every workspace file is valid Markdown that humans can read AND contains structured YAML frontmatter that tools can parse.
2. **File-native**: A workspace is a directory. No database, no server, no runtime required. Git-compatible by default.
3. **Framework-agnostic**: Any agent framework (Claude Code, CrewAI, LangGraph, AutoGen, custom) can read/write AWP workspaces.
4. **Incrementally adoptable**: A valid workspace can be as minimal as a single `IDENTITY.md` file.
5. **Interoperable**: AWP identities export to A2A Agent Cards. AWP operations expose via MCP. AWP DIDs are W3C-compatible.

## 2. Workspace Structure

A workspace is a directory containing well-known files at predictable paths:

```
<workspace-root>/
  .awp/
    workspace.json          # REQUIRED — workspace manifest
  IDENTITY.md               # REQUIRED — agent identity
  SOUL.md                   # REQUIRED — behavioral constraints and values
  AGENTS.md                 # OPTIONAL — operational instructions
  USER.md                   # OPTIONAL — human profile
  TOOLS.md                  # OPTIONAL — environment-specific configuration
  HEARTBEAT.md              # OPTIONAL — periodic task definitions
  BOOTSTRAP.md              # OPTIONAL — first-run onboarding (see §8.1 Lifecycle)
  MEMORY.md                 # OPTIONAL — curated long-term memory
  memory/                   # OPTIONAL — daily memory logs
    YYYY-MM-DD.md           # Daily log entries
```

### 2.1 Workspace Manifest (`.awp/workspace.json`)

Every workspace MUST contain a `.awp/workspace.json` manifest:

```json
{
  "$schema": "https://awp.dev/schemas/workspace.schema.json",
  "awp": "0.1.0",
  "id": "urn:awp:workspace:unique-id",
  "name": "My Agent Workspace",
  "created": "2026-01-30T00:00:00Z",
  "agent": {
    "did": "did:web:example.com:agents:my-agent",
    "identityFile": "IDENTITY.md"
  },
  "capabilities": ["code-review", "research", "writing"],
  "protocols": {
    "a2a": true,
    "mcp": true
  }
}
```

**Fields:**
- `awp` (string, REQUIRED): AWP specification version
- `id` (string, REQUIRED): Unique workspace identifier (URN format)
- `name` (string, REQUIRED): Human-readable workspace name
- `created` (string, REQUIRED): ISO 8601 creation timestamp
- `agent.did` (string, OPTIONAL): W3C DID for this agent
- `agent.identityFile` (string, REQUIRED): Path to identity file relative to workspace root
- `capabilities` (string[], OPTIONAL): Agent capability tags
- `protocols` (object, OPTIONAL): Supported protocol flags

## 3. File Format

### 3.1 Dual-Format Convention

All `.md` workspace files use the dual-format convention:

```markdown
---
awp: "0.1.0"
type: "<file-type>"
# ... structured fields ...
---

# Human-Readable Title

Free-form Markdown content...
```

The YAML frontmatter between `---` delimiters contains machine-parseable structured data. The Markdown body below contains human-readable narrative content. Both are authoritative — tools read the frontmatter; humans read the body.

### 3.2 Common Frontmatter Fields

All workspace files SHOULD include:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `awp` | string | YES | AWP spec version |
| `type` | string | YES | File type identifier |
| `lastModified` | string | NO | ISO 8601 timestamp of last modification |
| `modifiedBy` | string | NO | DID of the agent or human who last modified |

## 4. Identity (`IDENTITY.md`)

The identity file defines **factual attributes** of the agent — what it is, what it's called, what it can do. It is REQUIRED.

> **IDENTITY vs SOUL:** IDENTITY contains facts (name, creature type, capabilities, avatar). SOUL contains personality and values (vibe, behavioral constraints, governance). If it answers "what are you?" it belongs in IDENTITY. If it answers "who are you?" it belongs in SOUL.

### 4.1 Frontmatter Schema

```yaml
---
awp: "0.1.0"
type: "identity"
did: "did:web:example.com:agents:my-agent"
name: "Clawd"
creature: "familiar"
emoji: "🐾"
avatar: "avatars/clawd.png"
capabilities:
  - code-review
  - research
  - writing
created: "2026-01-30T00:00:00Z"
lastModified: "2026-01-30T00:00:00Z"
---
```

**Fields:**
- `did` (string, OPTIONAL): W3C Decentralized Identifier. Generated via `awp identity generate`.
- `name` (string, REQUIRED): The agent's chosen name
- `creature` (string, OPTIONAL): What kind of entity — factual descriptor (AI assistant, familiar, etc.)
- `emoji` (string, OPTIONAL): Signature emoji
- `avatar` (string, OPTIONAL): Path to avatar image (workspace-relative or URL)
- `capabilities` (string[], OPTIONAL): What this agent can do
- `created` (string, REQUIRED): ISO 8601 creation timestamp

### 4.2 Agent Card Export

An AWP identity can be exported as an A2A-compatible Agent Card:

```json
{
  "name": "Clawd",
  "description": "sharp, warm, slightly chaotic",
  "url": "https://example.com/agents/clawd",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false
  },
  "skills": [
    { "id": "code-review", "name": "Code Review" },
    { "id": "research", "name": "Research" },
    { "id": "writing", "name": "Writing" }
  ],
  "authentication": {
    "schemes": ["did:web"]
  }
}
```

## 5. Soul (`SOUL.md`)

The soul file defines the agent's **personality, values, and behavioral constraints**. It is REQUIRED.

> **IDENTITY vs SOUL:** IDENTITY is the business card. SOUL is the character sheet. An agent could change its soul (evolve its personality, update its values) while keeping its identity stable.

### 5.1 Frontmatter Schema

```yaml
---
awp: "0.1.0"
type: "soul"
vibe: "sharp, warm, slightly chaotic"
values:
  - id: "genuine-helpfulness"
    priority: 1
    description: "Be genuinely helpful, not performatively helpful"
  - id: "have-opinions"
    priority: 2
    description: "Have opinions and disagree when warranted"
  - id: "resourcefulness"
    priority: 3
    description: "Try to figure things out before asking"
  - id: "earn-trust"
    priority: 4
    description: "Earn trust through competence"
  - id: "respect-access"
    priority: 5
    description: "Remember you're a guest in someone's life"
boundaries:
  - id: "privacy"
    rule: "Private things stay private. Period."
    severity: "hard"
  - id: "external-actions"
    rule: "Ask before acting externally"
    severity: "soft"
  - id: "quality"
    rule: "Never send half-baked replies"
    severity: "soft"
governance:
  humanApprovalRequired:
    - "sending emails"
    - "posting publicly"
    - "destructive commands"
  autonomouslyAllowed:
    - "reading files"
    - "searching the web"
    - "organizing workspace"
    - "updating memory"
lastModified: "2026-01-30T00:00:00Z"
---
```

**Fields:**
- `vibe` (string, OPTIONAL): Personality description — how the agent comes across
- `values` (array, OPTIONAL): Ordered list of core values
  - `id` (string): Identifier
  - `priority` (number): Priority rank (1 = highest)
  - `description` (string): Human-readable description
- `boundaries` (array, OPTIONAL): Behavioral boundaries
  - `id` (string): Identifier
  - `rule` (string): The boundary rule
  - `severity` (string): `"hard"` (never violate) or `"soft"` (use judgment)
- `governance` (object, OPTIONAL): Governance rules
  - `humanApprovalRequired` (string[]): Actions requiring human approval
  - `autonomouslyAllowed` (string[]): Actions the agent may take freely

## 6. Memory

### 6.1 Long-term Memory (`MEMORY.md`)

Curated, persistent memory. The agent's distilled understanding.

```yaml
---
awp: "0.1.0"
type: "memory-longterm"
lastCompacted: "2026-01-30T00:00:00Z"
entryCount: 12
---
```

### 6.2 Daily Logs (`memory/YYYY-MM-DD.md`)

Raw daily session logs.

```yaml
---
awp: "0.1.0"
type: "memory-daily"
date: "2026-01-30"
entries:
  - time: "10:30"
    content: "Discussed project architecture with Marc"
    tags: ["project", "architecture"]
  - time: "14:15"
    content: "Researched A2A protocol specification"
    tags: ["research", "protocols"]
---
```

**Fields:**
- `date` (string, REQUIRED): ISO 8601 date
- `entries` (array, OPTIONAL): Structured log entries
  - `time` (string): Time of entry (HH:MM)
  - `content` (string): What happened
  - `tags` (string[]): Categorization tags

## 7. User Profile (`USER.md`)

```yaml
---
awp: "0.1.0"
type: "user"
name: "Marc"
callSign: "Marc"
timezone: "Europe/Berlin"
---
```

## 8. Operational Config (`AGENTS.md`)

```yaml
---
awp: "0.1.0"
type: "operations"
sessionStartup:
  - "Read SOUL.md"
  - "Read USER.md"
  - "Read recent memory"
heartbeat:
  enabled: true
  intervalMinutes: 30
  checks:
    - "email"
    - "calendar"
    - "mentions"
memoryPolicy:
  dailyLogs: true
  longTermCompaction: true
  compactionInterval: "weekly"
---
```

### 8.1 Bootstrap Lifecycle (`BOOTSTRAP.md`)

`BOOTSTRAP.md` is a **single-use onboarding file**. It contains first-run instructions for an agent entering a new workspace.

**Lifecycle:**
1. When an agent starts a session and `BOOTSTRAP.md` exists, it MUST execute the bootstrap instructions before any other work.
2. After successful execution, the agent MUST delete `BOOTSTRAP.md`.
3. The agent SHOULD log the bootstrap completion in its daily memory.
4. If bootstrap fails, the agent MUST keep the file and report the failure to the human.

> `BOOTSTRAP.md` is the only workspace file that is intentionally ephemeral. All other files persist across sessions.

### 8.2 Environment Config (`TOOLS.md`)

`TOOLS.md` contains environment-specific configuration — device names, SSH hosts, API endpoints, speaker labels, and other local context that helps the agent operate in its physical/digital environment.

```yaml
---
awp: "0.1.0"
type: "tools"
---
```

Unlike skills (which define *how* tools work), `TOOLS.md` defines *your* specifics — what's unique to the current setup. This separation means skills can be shared without leaking infrastructure.

## 9. Memory Heuristics

### 9.1 When to Write What

| Write to... | When... | Examples |
|-------------|---------|---------|
| `memory/YYYY-MM-DD.md` (daily) | Something happened worth noting | Conversations, decisions, tasks completed, errors encountered |
| `MEMORY.md` (longterm) | A pattern or insight has been distilled from daily logs | User preferences, project conventions, learned heuristics, relationship context |

**Rules of thumb:**
- **Daily logs are raw.** Write liberally. Include timestamps. Tag entries for searchability. Think of them as a work journal.
- **Longterm memory is curated.** Only promote entries that will still be useful in 30 days. Think of it as a reference card.
- **Compaction is lossy on purpose.** When compacting daily logs into longterm memory, discard the mundane. Keep the insights.
- **When in doubt, log daily.** It's easier to promote a daily entry to longterm than to reconstruct a lost memory.

### 9.2 Pinned Memories

Memory entries can be marked as `pinned: true` to prevent compaction or deletion. Pinned entries survive all cleanup operations and MUST be preserved during any memory compaction process.

```yaml
entries:
  - time: "14:00"
    content: "User's preferred coding style: functional, no classes"
    tags: ["preference", "coding"]
    pinned: true
```

Use pinned memories sparingly — they represent information the agent considers permanently important.

## 10. Identity System

### 10.1 DID Method

AWP uses W3C Decentralized Identifiers. The recommended method is `did:web` for agents with web presence, or a locally-generated identifier for offline agents.

**DID Generation:**
- `did:web:domain:agents:name` for web-hosted agents
- `did:key:z6Mk...` for local/offline agents (Ed25519 key pair)

### 10.2 Signed Outputs

Agents with DIDs can sign their outputs:

```yaml
signature:
  signer: "did:web:example.com:agents:clawd"
  algorithm: "Ed25519"
  value: "base64-encoded-signature"
  timestamp: "2026-01-30T10:30:00Z"
```

## 11. Interoperability

### 11.1 MCP Integration

AWP workspaces expose operations as MCP tools:

| Tool | Description |
|------|-------------|
| `awp_read_identity` | Read agent identity |
| `awp_read_soul` | Read agent values and boundaries |
| `awp_read_memory` | Read memory entries |
| `awp_write_memory` | Append to memory |
| `awp_read_user` | Read human profile |
| `awp_workspace_status` | Get workspace health |

### 11.2 A2A Integration

AWP identities export as A2A Agent Cards for discovery. AWP workspaces can receive A2A tasks and route them through the agent's governance rules (SOUL.md boundaries).

### 11.3 ACK Integration

AWP agent DIDs are compatible with ACK-ID for payment identity. An AWP agent can attach ACK payment capabilities to its Agent Card export.

## 12. Validation

A valid AWP workspace MUST:
1. Contain `.awp/workspace.json` with valid manifest
2. Contain `IDENTITY.md` with valid frontmatter including `name`
3. Contain `SOUL.md` with valid frontmatter
4. Have all frontmatter fields conform to their respective JSON Schemas
5. Have `awp` version field in all workspace files

A valid AWP workspace SHOULD:
- Be a git repository
- Have agent DID generated
- Have memory directory initialized

## 13. Versioning

This specification follows Semantic Versioning. Breaking changes increment the major version. The `awp` field in frontmatter indicates which spec version the file conforms to.

---

## Appendix A: File Type Registry

| `type` value | File | Description |
|-------------|------|-------------|
| `identity` | IDENTITY.md | Agent identity |
| `soul` | SOUL.md | Values and boundaries |
| `operations` | AGENTS.md | Operational instructions |
| `user` | USER.md | Human profile |
| `tools` | TOOLS.md | Environment config |
| `heartbeat` | HEARTBEAT.md | Periodic tasks |
| `bootstrap` | BOOTSTRAP.md | First-run onboarding |
| `memory-longterm` | MEMORY.md | Curated memory |
| `memory-daily` | memory/*.md | Daily logs |

## Appendix B: Reserved Directories

| Directory | Purpose |
|-----------|---------|
| `.awp/` | Workspace metadata and manifest |
| `memory/` | Daily memory logs |
| `artifacts/` | Knowledge artifacts (Phase 2: SMP) |
| `contracts/` | Delegation contracts (Phase 3: RDP) |
| `canvas/` | UI canvases and dashboards |
