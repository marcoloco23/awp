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
│           Coordination Layer (Phase 4) ✅             │
│   projects · tasks · authority merge · status        │
├─────────────────────────────────────────────────────┤
│      Reputation & Delegation Layer (Phase 3) ✅      │
│   multi-dim reputation · contracts · disputes        │
├─────────────────────────────────────────────────────┤
│        Shared Memory Protocol (Phase 2) ✅           │
│   versioned artifacts · fork/merge · provenance      │
├─────────────────────────────────────────────────────┤
│     Agent Workspace Protocol (Phase 1) ✅            │
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
- **@agent-workspace/core** — Shared types and constants
- **@agent-workspace/cli** — CLI with 7 commands: `init`, `validate`, `inspect`, `identity generate`, `identity export`, `memory log`, `memory search`
- **@agent-workspace/mcp-server** — MCP server exposing 6 tools: `awp_read_identity`, `awp_read_soul`, `awp_read_user`, `awp_read_memory`, `awp_write_memory`, `awp_workspace_status`

### Workspace Integration
- All root files (IDENTITY.md, SOUL.md, USER.md, AGENTS.md) have AWP frontmatter
- `.awp/workspace.json` manifest created
- `templates/clawd/` — reference implementation template

## What's Built (Phase 2 — Complete)

### Shared Memory Protocol (SMP)
- `spec/smp/smp-spec.md` — Full SMP specification
- `spec/schemas/knowledge-artifact.schema.json` — Knowledge artifact JSON Schema
- CLI extensions: `awp artifact create`, `awp artifact commit`, `awp artifact list`, `awp artifact search`, `awp artifact log`, `awp artifact merge`
- MCP extensions: `awp_artifact_read`, `awp_artifact_write`, `awp_artifact_list`, `awp_artifact_search`
- Versioned artifacts with provenance, confidence scores, and additive merge

## What's Built (Phase 3 — Complete)

### Reputation & Delegation Protocol (RDP)
- `spec/rdp/rdp-spec.md` — Full RDP specification
- `spec/schemas/reputation-profile.schema.json` — Reputation profile JSON Schema
- `spec/schemas/delegation-contract.schema.json` — Delegation contract JSON Schema
- Core types: `ReputationProfileFrontmatter`, `ReputationDimension`, `ReputationSignal`, `DelegationContractFrontmatter`, `ContractTask`, `ContractScope`, `ContractConstraints`, `ContractEvaluation`
- CLI: `awp reputation query|signal|list` + `awp contract create|list|show|evaluate`
- MCP: `awp_reputation_query`, `awp_reputation_signal`, `awp_contract_create`, `awp_contract_evaluate`
- EWMA score updates (α=0.15), time-based decay (0.02/month, floor 0.5), confidence from sample size
- Contract evaluation automatically generates reputation signals for delegate

## What's Built (Phase 4 Primitives — Complete)

### Coordination Protocol (CDP)
- `spec/cdp/cdp-spec.md` — Full CDP specification (projects, tasks, member roles, reputation gates, authority merge)
- `spec/schemas/project.schema.json` — Project JSON Schema
- `spec/schemas/task.schema.json` — Task JSON Schema
- Core types: `ProjectFrontmatter`, `ProjectMember`, `TaskFrontmatter`
- CLI: `awp project create|list|show|close` + `awp task create|list|update|show` + `awp status`
- MCP: `awp_project_create`, `awp_project_list`, `awp_project_status`, `awp_task_create`, `awp_task_update`, `awp_task_list`, `awp_artifact_merge`
- Enhanced `awp_workspace_status` with project/task data and health warnings
- Authority merge strategy for artifacts (uses reputation to order conflicting content)
- Expanded `awp validate` — scans all content directories (artifacts, reputation, contracts, projects, tasks)
- Reputation-gated task assignments (advisory warnings, not blocking)
- Task dependencies (blockedBy/blocks) with downstream warnings

---

## Phase 2: Shared Memory Protocol (SMP) — ✅ Complete (v0.2.0)

Versioned knowledge artifacts with provenance, confidence scores, and merge. See `spec/smp/smp-spec.md`.

**Deferred to future:**
- `packages/awp-sync/` — Workspace-to-workspace artifact sync (needs A2A transport)

---

## Phase 3: Reputation & Delegation Protocol (RDP) — ✅ Complete (v0.3.0)

Multi-dimensional reputation profiles with EWMA scoring, time-based decay, delegation contracts, and contract evaluation that auto-generates reputation signals. See `spec/rdp/rdp-spec.md`.

**Deferred to future:**
- Dispute resolution system (needs multi-agent adjudication)
- Cross-org lossy reputation transfer (needs multi-workspace sync)
- Consensus panels / third-party review (needs A2A transport)

---

## Phase 4: Coordination Protocol — ✅ Primitives Complete (v0.4.0)

Projects, tasks, authority merge, rich status. See `spec/cdp/cdp-spec.md`.

**Deferred to future:**
- Dependency graph traversal / topological sort (cycle detection)
- Swarm definitions with dynamic role recruitment
- Shared lib extraction to awp-core (refactoring)
- MCP server modularization into tool files

---

## Phase 5: Coordination Platform (Next)

**Problem:** CDP v1.0 provides single-workspace coordination primitives but the platform needs dynamic multi-agent orchestration, visual governance, and cross-workspace communication.

**What to build:**

### Agent Swarm Definitions
Dynamic multi-agent composition with role recruitment based on reputation:
```yaml
type: "swarm"
goal: "Complete Q3 product launch"
governance:
  human_lead: "user:marc"
  veto_power: true
roles:
  researcher: { min_reputation: { ai-research: 0.8 } }
  writer: { min_reputation: { technical-writing: 0.7 } }
```

### Dependency Graph Engine
- Topological sort for task ordering
- Cycle detection and reporting
- Automatic status propagation (blocked ← dependency)
- Critical path analysis

### Human Governance Dashboard (Next.js)
- Agent roster with reputation profiles
- Project task boards with dependency graphs
- Knowledge artifact browser with version history
- Escalation queue for items requiring human decision
- Full audit trail

### Components
- `packages/awp-dashboard/` — Next.js governance dashboard
- A2A integration for inter-agent task routing
- AG-UI integration for real-time agent status streaming
- `packages/awp-sync/` — Workspace-to-workspace sync

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
- Project coordination embeds task history and reputation gates (switching = losing workflow context)
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
    smp/smp-spec.md            # Phase 2: Shared Memory Protocol ✅
    rdp/rdp-spec.md            # Phase 3: Reputation & Delegation ✅
    cdp/cdp-spec.md            # Phase 4: Coordination Protocol ✅

  packages/
    awp-core/                  # Shared types, constants, schemas ✅
    awp-cli/                   # CLI tool ✅
    awp-mcp-server/            # MCP server ✅
    awp-sync/                  # Phase 5: Workspace-to-workspace sync
    awp-dashboard/             # Phase 5: Human governance dashboard

  templates/
    clawd/                     # Reference workspace template ✅

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
