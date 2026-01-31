# AWP — Coordination Infrastructure for the Agent Economy

## Thesis

Build the operating system for an agent economy, not another app inside it.

**The wedge:** A portable, open **Agent Workspace Protocol (AWP)** — the "package.json of agents" — that defines identity, behavior, memory, reputation, and coordination in a framework-agnostic, version-controlled, human-readable format.

**Why this wins:** A2A owns transport. MCP owns tools. ACK owns payments. Nobody owns the definition of the agent itself — its persistent state, behavioral constraints, accumulated knowledge, and reputation. That's the layer below all other protocols. The workspace template already sketches it in markdown. We formalize it into infrastructure.

**Lock-in:** Agents accumulate memory, reputation, and provenance in AWP format. The longer they run, the more valuable the workspace becomes and the harder it is to leave. Every delegation between AWP agents pulls more into the ecosystem.

## Strategic Positioning

```
┌─────────────────────────────────────────────────────┐
│         Experiment Protocol (Phase 6) ○              │
│   manifestos · societies · simulation · comparison   │
├─────────────────────────────────────────────────────┤
│           Human Governance Layer (Phase 5) ✅         │
│     dashboard · metrics · audit · visual governance   │
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

## What's Built (Phase 4 — Complete)

### Coordination Protocol (CDP)
- `spec/cdp/cdp-spec.md` — Full CDP specification (projects, tasks, member roles, reputation gates, authority merge)
- `spec/schemas/project.schema.json` — Project JSON Schema
- `spec/schemas/task.schema.json` — Task JSON Schema
- `spec/schemas/swarm.schema.json` — Swarm JSON Schema
- Core types: `ProjectFrontmatter`, `ProjectMember`, `TaskFrontmatter`, `SwarmFrontmatter`, `SwarmRole`, `SwarmGovernance`
- CLI: `awp project create|list|show|close` + `awp task create|list|update|show|graph` + `awp swarm create|list|show|update|recruit` + `awp status`
- MCP: `awp_project_*`, `awp_task_*` (including `awp_task_graph`), `awp_swarm_*` tools
- Enhanced `awp_workspace_status` with project/task data and health warnings
- Authority merge strategy for artifacts (uses reputation to order conflicting content)
- Expanded `awp validate` — scans all content directories (artifacts, reputation, contracts, projects, tasks, swarms)
- Reputation-gated task assignments (advisory warnings, not blocking)
- Task dependencies (blockedBy/blocks) with dependency graph analysis
- Dependency graph engine with topological sort, cycle detection, critical path
- Swarm definitions with dynamic role recruitment based on reputation

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

## What's Built (Phase 5 — Complete)

### Human Governance Dashboard
- `packages/awp-dashboard/` — Next.js 15 App Router dashboard (private package, not published to npm)
- Custom "Protocol Blue" design system with dark/light themes
- 8 pages: overview, projects (with kanban task board), reputation (with radar chart), artifacts (with provenance timeline), contracts, memory
- 11 JSON API routes for programmatic access
- Direct filesystem reads via Server Components (no API hop)
- Recharts visualizations, Score gauges, responsive layout
- `AWP_WORKSPACE` env var points to workspace directory

---

## Phase 4: Coordination Protocol — ✅ Complete (v0.4.1)

Projects, tasks, authority merge, rich status. See `spec/cdp/cdp-spec.md`.

### v0.4.1 Additions
- **Dependency Graph Engine** — `awp task graph <project>` with topological sort, cycle detection, critical path analysis
- **Swarm Definitions** — Multi-agent composition with reputation-gated role recruitment
  - `awp swarm create|list|show|update`
  - `awp swarm role add` with reputation requirements
  - `awp swarm recruit [--auto]` for dynamic agent assignment
  - `spec/schemas/swarm.schema.json` — Swarm JSON Schema
- **Shared Library Extraction** — Pure logic moved to `@agent-workspace/utils`
- **MCP Server Modularization** — Split into tool modules for maintainability

---

## Phase 5: Human Governance Dashboard — ✅ Complete (v0.5.0)

**Problem:** CDP provides single-workspace coordination primitives but humans interact through CLI or MCP tools. A visual dashboard makes the workspace legible at a glance — essential for human governance of agent work.

**What's done (moved from Phase 5 to Phase 4):**
- ✅ Swarm definitions with dynamic role recruitment
- ✅ Dependency graph engine (topological sort, cycle detection, critical path)

**What's built in v0.5.0:**

### Human Governance Dashboard (`packages/awp-dashboard/`)
- Next.js 15 App Router with Server Components reading filesystem directly
- Custom "Protocol Blue" design system: dark-first palette, Inter + JetBrains Mono fonts
- 8 pages: overview, projects, project detail (kanban task board), reputation roster, agent profile, artifacts, artifact detail (provenance timeline), contracts, memory
- 11 JSON API routes as secondary data interface
- Agent identity card with health warnings and workspace metrics
- Reputation profiles with Recharts RadarChart visualization
- Score gauges, progress bars, and dimension breakdowns with decayed scores
- Task boards with 5 kanban columns (pending → completed), priority-colored indicators
- Knowledge artifact browser with confidence bars and provenance timelines
- Contract list with weighted evaluation scores
- Memory timeline with daily log entries and long-term memory
- Dark/light theme toggle with localStorage persistence
- Responsive layout with collapsible sidebar
- Graceful empty states for workspaces with no data

### What's next (Phase 6):
- `packages/awp-sync/` — Workspace-to-workspace artifact sync
- A2A integration for inter-agent task routing
- AG-UI integration for real-time agent status streaming
- Dashboard write operations (currently read-only)
- Real-time updates / WebSocket

---

## Phase 6: Experiment Protocol (EXP) — Planned

**Problem:** We have coordination infrastructure, but no way to systematically test which institutional designs produce aligned, coordinated, purified agent societies. Different value systems, governance rules, and fitness functions should produce measurably different outcomes.

**The Big Question:** What if different manifestos could create different agent societies, and we could run controlled experiments to see which institutional designs work best?

**What to build:**

### Manifesto as Configuration
- Machine-readable frontmatter in MANIFESTO.md encoding values, fitness weights, constraints, lifecycle rules
- `spec/schemas/manifesto.schema.json` — Manifesto JSON Schema ✅
- Multiple example manifestos: purification, market-dynamics, monastic, baseline

### Society Containers
- Isolated environments for agent populations under a manifesto
- `spec/schemas/society.schema.json` — Society JSON Schema ✅
- `societies/` directory with agent workspaces, shared state, metrics
- Resource constraints enforced by manifesto

### Experiment Framework
- `spec/experiment/experiment-spec.md` — Full EXP specification ✅
- `spec/schemas/experiment.schema.json` — Experiment JSON Schema ✅
- Run societies through simulated contract cycles
- Measure fitness, purity, role emergence, anti-patterns
- Compare across manifestos with statistical tests

### Simulation Engine
- Task simulation based on agent reputation
- Probabilistic outcomes (success, quality)
- Lifecycle event processing (birth, death, merge)
- Anti-pattern detection and penalties

### CLI Commands
```bash
awp manifesto validate|show|diff
awp society create|list|show|cycle|run|pause|archive
awp experiment create|run|show|compare|export
```

### Role Emergence Detection
- Cluster successful contracts by pattern
- Extract role templates from clusters
- Formalize institutions, not organisms

### Dashboard Integration
- Society comparison charts
- Fitness time series
- Purity distribution histograms
- Role emergence timeline
- Anti-pattern frequency heatmaps

**What this enables:**
- Scientific testing of institutional design hypotheses
- "Purification-oriented manifestos produce higher trust stability than market-oriented manifestos"
- Reproducible experiments with random seeds
- Evidence-based manifesto refinement

**Success criteria:**
1. Reproducibility — Same manifesto + seed → same outcomes
2. Discrimination — Different manifestos → measurably different societies
3. Role emergence — Templates extracted from successful patterns
4. Human insight — Experiments inform real design decisions

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
    experiment/experiment-spec.md  # Phase 6: Experiment Protocol ✅

  packages/
    awp-core/                  # Shared types, constants, schemas ✅
    awp-utils/                 # Shared utilities (validation, reputation math) ✅
    awp-cli/                   # CLI tool ✅
    awp-mcp-server/            # MCP server ✅
    awp-dashboard/             # Human governance dashboard ✅
    awp-sync/                  # Phase 6: Workspace-to-workspace sync
    awp-experiment/            # Phase 6: Experiment simulation engine

  templates/
    clawd/                     # Reference workspace template ✅
  
  societies/                   # Phase 6: Society containers (gitignored by default)
  experiments/                 # Phase 6: Experiment definitions and results

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
