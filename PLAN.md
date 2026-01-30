# AWP — Coordination Infrastructure for the Agent Economy

## Thesis

Build the operating system for an agent economy, not another app inside it.

**The wedge:** A portable, open **Agent Workspace Protocol (AWP)** — the "package.json of agents" — that defines identity, behavior, memory, reputation, and coordination in a framework-agnostic, version-controlled, human-readable format.

**Why this wins:** A2A owns transport. MCP owns tools. ACK owns payments. Nobody owns the definition of the agent itself — its persistent state, behavioral constraints, accumulated knowledge, and reputation. That's the layer below all other protocols. The workspace template already sketches it in markdown. We formalize it into infrastructure.

**Lock-in:** Agents accumulate memory, reputation, and provenance in AWP format. The longer they run, the more valuable the workspace becomes and the harder it is to leave. Every delegation between AWP agents pulls more into the ecosystem.

## Strategic Positioning

```
┌─────────────────────────────────────────────────────┐
│              Human Governance Layer                  │
│         dashboards · veto · escalation · audit       │
├─────────────────────────────────────────────────────┤
│           Coordination Layer (Phase 4)               │
│      task boards · swarms · dependency graphs        │
├─────────────────────────────────────────────────────┤
│      Reputation & Delegation Layer (Phase 3)         │
│   multi-dim reputation · contracts · disputes        │
├─────────────────────────────────────────────────────┤
│        Shared Memory Protocol (Phase 2)              │
│   versioned artifacts · fork/merge · provenance      │
├─────────────────────────────────────────────────────┤
│     Agent Workspace Protocol (Phase 1) ← HERE       │
│   identity · soul · memory · workspace manifest      │
├─────────────────────────────────────────────────────┤
│          Existing Protocols (not ours)               │
│       A2A (transport) · MCP (tools) · ACK (pay)     │
└─────────────────────────────────────────────────────┘
```

AWP is complementary to all existing protocols, competitive with none. It sits below all of them — defining what the agent *is*, while they define what the agent *does*.

## What's Built (Phase 1 — Complete)

### Specification
- `spec/awp-spec.md` — Full protocol spec: dual-format files, workspace structure, identity system, interop
- `spec/schemas/` — 7 JSON Schemas (workspace, identity, soul, user, operations, memory-daily, memory-longterm)

### Packages (TypeScript monorepo, all build clean)
- **@awp/core** — Shared types and constants
- **@awp/cli** — CLI with 7 commands: `init`, `validate`, `inspect`, `identity generate`, `identity export`, `memory log`, `memory search`
- **@awp/mcp-server** — MCP server exposing 6 tools: `awp_read_identity`, `awp_read_soul`, `awp_read_user`, `awp_read_memory`, `awp_write_memory`, `awp_workspace_status`

### Workspace Integration
- All root files (IDENTITY.md, SOUL.md, USER.md, AGENTS.md) have AWP frontmatter
- `.awp/workspace.json` manifest created
- `templates/clawd/` — reference implementation template

---

## Phase 2: Shared Memory Protocol (SMP)

**Problem:** Agents produce knowledge but have no way to version, share, fork, or merge it across organizational boundaries. Memory is trapped in individual chat logs.

**What to build:**

### Knowledge Artifact Format
A versioned document with structured metadata:
```yaml
---
awp: "0.1.0"
smp: "1.0"
type: "knowledge-artifact"
id: "artifact:llm-context-research"
title: "LLM Context Window Research"
authors:
  - did:key:zAgent1
  - did:key:zAgent2
branch: "main"
version: 7
confidence: 0.85
scope: ["ai-research"]
provenance:
  - agent: "did:key:zAgent1"
    action: "created"
    timestamp: "2026-02-15T10:30:00Z"
access:
  read: ["org:acme"]
  write: ["did:key:zAgent1"]
  fork: "public"
---
```

### Merge Strategies for Knowledge (not code)
- **Additive** — both agents' claims combined (research aggregation)
- **Authority** — agent with higher domain reputation wins (contradictory facts)
- **Consensus** — N agents must agree before a fact is promoted
- **Human escalation** — flag for human when above can't resolve

Not CRDTs (wrong problem — agents don't co-edit simultaneously). Not structured diff/patch (too low-level). The merge operates on *claims* and *confidence*, not text.

### Components
- `spec/smp/smp-spec.md` — Shared Memory Protocol specification
- `packages/awp-smp/` — Library: create, version, branch, merge, sync artifacts
- CLI extensions: `awp artifact create/commit/branch/merge/share/fork`
- MCP extensions: `awp_artifact_read`, `awp_artifact_write`, `awp_artifact_search`
- `packages/awp-sync/` — Workspace-to-workspace artifact sync (git-backed, A2A transport)

### Standalone Value
- Agents version their knowledge, not just memory logs
- Multiple agents share and merge findings on the same project
- Full audit trail of who contributed what
- Knowledge artifacts are forkable — build on public research

---

## Phase 3: Reputation & Delegation Protocol (RDP)

**Problem:** No standard for evaluating agent trustworthiness or defining cognitive contracts. Current systems are binary (trusted/untrusted) with no decay, no context, no domain specificity.

**What to build:**

### Multi-Dimensional Reputation
```yaml
dimensions:
  reliability:
    score: 0.92
    confidence: 0.85
    sample_size: 47
    decay_rate: 0.02      # per month
  epistemic_hygiene:
    score: 0.88
    confidence: 0.72
  domain_competence:
    "ai-research": { score: 0.95, confidence: 0.90 }
    "legal-analysis": { score: 0.45, confidence: 0.30 }
  coordination_behavior:
    score: 0.78
    confidence: 0.60
```

Key design decisions:
- **Decay built in** — scores decrease without new signals (prevents immortal feudal lords)
- **Confidence separate from score** — low data ≠ low trust, it means *unknown*
- **Domain competence is a map** — an agent's reputation in "ai-research" is independent of "legal-analysis"
- **Cross-org transfer is lossy** — your team's high rating shouldn't automatically transfer to external orgs

### Delegation Contracts
```yaml
type: "delegation-contract"
delegator: "did:key:zJarvis"
delegate: "did:key:zResearchBot"
task:
  description: "Research LLM context window techniques"
  scope:
    include: ["papers 2025-2026", "benchmarks"]
    exclude: ["proprietary data", "speculation"]
  output_format: "knowledge-artifact"
constraints:
  require_citations: true
  confidence_threshold: 0.7
evaluation:
  criteria:
    completeness: 0.3
    accuracy: 0.4
    clarity: 0.2
    timeliness: 0.1
```

### Dispute Resolution (tiered)
1. Automated rule matching (clear, measurable criteria)
2. Third-party agent review (neutral, high-reputation domain expert)
3. Consensus panel (multiple agents vote)
4. Human escalation (governance authority decides)

### Components
- `spec/rdp/rdp-spec.md` — Reputation & Delegation Protocol specification
- `packages/awp-rdp/` — Bayesian reputation updating, lossy cross-org transfer, contract lifecycle, dispute resolution
- CLI extensions: `awp reputation query`, `awp contract create/evaluate`
- MCP extensions: `awp_reputation_query`, `awp_contract_create`, `awp_dispute_initiate`

### Standalone Value
- Agents query reputation before delegating work
- Delegation contracts provide clear accountability
- Dispute resolution prevents tragedy of the commons

---

## Phase 4: Coordination Platform

**Problem:** At scale, agents duplicate work, coordination becomes overhead, and humans can't tell which systems matter. Posting is dead. What replaces it: task boards, dependency graphs, agent swarms with explicit roles.

**What to build:**

### Agent Swarm Primitives
```yaml
type: "swarm"
goal: "Complete Q3 product launch"
governance:
  human_lead: "user:marc"
  veto_power: true
  budget_limit: "$500"
roles:
  lead: { agent: "did:key:zJarvis", responsibilities: ["coordination", "review"] }
  researcher: { agent: "did:key:zResearchBot", min_reputation: { ai-research: 0.8 } }
  writer: { agent: "did:key:zWriter", min_reputation: { technical-writing: 0.7 } }
task_board:
  - { id: "task-1", title: "Competitive analysis", assigned_to: "researcher", status: "in_progress" }
  - { id: "task-2", title: "Write positioning doc", assigned_to: "writer", depends_on: ["task-1"] }
```

### Human Governance Dashboard (Next.js)
- Agent roster with reputation profiles
- Project task boards with dependency graphs
- Knowledge artifact browser with version history
- Escalation queue for items requiring human decision
- Full audit trail

Humans are governors, not operators. The dashboard replaces chat as the interface.

### Components
- `spec/coord/coord-spec.md` — Coordination Protocol specification
- `packages/awp-coord/` — Projects, task boards, swarm composition, dependency graphs
- `packages/awp-dashboard/` — Next.js governance dashboard
- A2A integration for inter-agent task routing
- AG-UI integration for real-time agent status streaming

---

## Adoption Strategy

### Sequence
1. **Ship MCP server to npm** — any MCP client gets AWP workspace tools instantly. Zero framework change. They don't need to know "AWP" exists.
2. **Ship `awp init` as standalone CLI** — replaces manual "copy these markdown files" pattern.
3. **Dogfood internally** — the clawd workspace is the reference implementation.
4. **Court framework authors** — CrewAI, LangGraph, AutoGen — to add AWP import/export.
5. **Submit spec to AAIF** (Linux Foundation, where MCP + A2A live) for standardization.

### Why It Sticks
- MCP server = adoption without awareness (trojan horse)
- Memory accumulates in AWP format (switching = losing history)
- Reputation stored in AWP format (switching = losing trust)
- Delegation contracts reference AWP artifacts (switching = losing provenance)
- Open spec + Apache 2.0 = network effects > proprietary lock-in

---

## Project Structure

```
awp/                           # Public repo: github.com/marcoloco23/awp
  PLAN.md                      ← you are here
  package.json                 # Monorepo root (npm workspaces + Turborepo)
  turbo.json
  tsconfig.base.json
  .gitignore

  spec/
    awp-spec.md                # Phase 1: Core specification ✅
    schemas/                   # JSON Schemas ✅
    smp/smp-spec.md            # Phase 2: Shared Memory Protocol
    rdp/rdp-spec.md            # Phase 3: Reputation & Delegation
    coord/coord-spec.md        # Phase 4: Coordination Protocol

  packages/
    awp-core/                  # Shared types, constants, schemas ✅
    awp-cli/                   # CLI tool ✅
    awp-mcp-server/            # MCP server ✅
    awp-smp/                   # Phase 2: Shared Memory library
    awp-rdp/                   # Phase 3: Reputation & Delegation library
    awp-coord/                 # Phase 4: Coordination engine
    awp-sync/                  # Phase 2: Workspace-to-workspace sync
    awp-dashboard/             # Phase 4: Human governance dashboard

  templates/
    clawd/                     # Reference workspace template ✅

  canvas/index.html            # Dashboard canvas template

clawd/                         # Private repo: personal agent workspace
  .awp/workspace.json          # AWP manifest
  IDENTITY.md                  # Agent identity
  SOUL.md                      # Agent personality + values
  USER.md                      # Human profile
  AGENTS.md                    # Operational config
  HEARTBEAT.md                 # Periodic tasks
  TOOLS.md                     # Environment config
  memory/                      # Daily logs
```

---

## The North Star

> We are building the coordination infrastructure that allows intelligence to scale without collapsing into noise or tyranny.

The winners of the agent economy won't be the smartest agents. They'll be the ones embedded deepest into workflows. AWP is the substrate that makes embedding possible — portable identity, structured memory, earned reputation, governed coordination.

Like TCP/IP, if we get this right it won't win by being flashy. It'll win by being unavoidable.
