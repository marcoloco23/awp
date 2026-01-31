# AWP — Agent Workspace Protocol

The portable, open format for AI agent identity, memory, and behavior.

AWP defines what an agent **is** — its persistent state, behavioral constraints, accumulated knowledge, reputation, and coordinated work — in framework-agnostic, version-controlled, human-readable files.

```
your-agent/
  .awp/workspace.json    # Workspace manifest
  IDENTITY.md            # Who the agent is (name, capabilities, DID)
  SOUL.md                # How the agent behaves (values, boundaries, governance)
  USER.md                # Human profile (optional)
  AGENTS.md              # Operational instructions (optional)
  TOOLS.md               # Environment config (optional)
  memory/                # Structured daily logs
    2026-01-30.md
  artifacts/             # Versioned knowledge artifacts (SMP)
    llm-research.md
  reputation/            # Multi-dimensional reputation profiles (RDP)
    research-bot.md
  contracts/             # Delegation contracts (RDP)
    q3-research.md
  projects/              # Coordination projects and tasks (CDP)
    q3-launch.md
    q3-launch/tasks/
      competitive-analysis.md
  swarms/                # Multi-agent composition (CDP)
    q3-launch-team.md
```

Every file is valid Markdown (human-readable) with structured YAML frontmatter (machine-parseable). No database, no server, no runtime. Just files in a directory, compatible with Git by default.

## Quick Start

```bash
npm install -g @agent-workspace/cli

# Scaffold a new agent workspace
awp init

# Check it's valid
awp validate

# See what you've got
awp inspect

# Generate a DID identity
awp identity generate

# Export as A2A Agent Card
awp identity export
```

## Why AWP?

A2A owns transport. MCP owns tools. ACK owns payments. **Nobody owns the definition of the agent itself.**

AWP sits below all other protocols — defining what the agent *is*, while they define what the agent *does*.

| Protocol | Solves | AWP Relationship |
|----------|--------|------------------|
| MCP | Agent-to-tool integration | AWP ships as an MCP server |
| A2A | Agent-to-agent transport | AWP provides the state layer on top |
| ACK | Agent identity for payments | AWP imports ACK-ID, adds behavior + memory |

## Packages

| Package | Description | Install |
|---------|-------------|---------|
| [@agent-workspace/core](packages/awp-core/) | Types, constants, JSON schemas | `npm i @agent-workspace/core` |
| [@agent-workspace/utils](packages/awp-utils/) | Shared utilities (validation, reputation math) | `npm i @agent-workspace/utils` |
| [@agent-workspace/cli](packages/awp-cli/) | CLI tool (init, validate, inspect, status, identity, memory, artifact, reputation, contract, project, task, swarm, experiment) | `npm i -g @agent-workspace/cli` |
| [@agent-workspace/mcp-server](packages/awp-mcp-server/) | MCP server for any MCP-compatible client | `npm i @agent-workspace/mcp-server` |
| [@agent-workspace/agent](packages/awp-agent/) | Agent runtime for experiments (OpenAI, Anthropic) | `npm i @agent-workspace/agent` |
| [@agent-workspace/dashboard](packages/awp-dashboard/) | Human governance dashboard (Next.js) | Private — run locally |

## Dashboard

Visual governance layer for AWP workspaces. Reads workspace files from disk and displays agent identity, projects, tasks, reputation, artifacts, contracts, and memory.

```bash
# Run the dashboard (point to a workspace)
AWP_WORKSPACE=/path/to/workspace npm run dev --workspace=packages/awp-dashboard

# Opens at http://localhost:3000
```

Pages:
- **Overview** — Agent identity, health warnings, workspace metrics, active tasks
- **Projects** — Project list with progress bars, detail pages with kanban task boards
- **Reputation** — Agent roster with score gauges, profile pages with radar charts
- **Artifacts** — Knowledge browser with confidence bars, detail with provenance timelines
- **Contracts** — Delegation contracts with evaluation scores
- **Memory** — Daily log timeline with long-term memory

## MCP Server

Plug any AWP workspace into Claude Code, Cursor, or any MCP client:

```bash
# Add to Claude Code
claude mcp add awp-workspace -- npx @agent-workspace/mcp-server

# Or with a specific workspace path
AWP_WORKSPACE=/path/to/workspace npx @agent-workspace/mcp-server
```

Tools exposed:
- `awp_read_identity` — Read agent identity
- `awp_read_soul` — Read behavioral constraints
- `awp_read_user` — Read human profile
- `awp_read_memory` — Read memory (daily or long-term)
- `awp_write_memory` — Log structured memory entries
- `awp_artifact_read` — Read a knowledge artifact
- `awp_artifact_write` — Create or update a knowledge artifact
- `awp_artifact_list` — List all artifacts
- `awp_artifact_search` — Search artifacts
- `awp_reputation_query` — Query agent reputation (with time-based decay)
- `awp_reputation_signal` — Log a reputation signal
- `awp_contract_create` — Create a delegation contract
- `awp_contract_evaluate` — Evaluate a contract and generate reputation signals
- `awp_project_create` — Create a coordination project
- `awp_project_list` — List projects with status filter
- `awp_project_status` — Project details with task summary
- `awp_task_create` — Create a task within a project
- `awp_task_update` — Update task status or assignee
- `awp_task_list` — List tasks for a project
- `awp_task_graph` — Analyze task dependencies (topological sort, cycles, critical path)
- `awp_artifact_merge` — Merge artifacts (additive or authority strategy)
- `awp_swarm_create` — Create a multi-agent swarm
- `awp_swarm_list` — List swarms with status filter
- `awp_swarm_show` — Show swarm details and staffing
- `awp_swarm_recruit` — Find candidates for unfilled roles
- `awp_swarm_assign` — Assign agent to swarm role
- `awp_swarm_role_add` — Add a role to a swarm
- `awp_workspace_status` — Workspace summary with health warnings

## Reputation & Delegation (RDP)

Track agent trustworthiness and define work agreements:

```bash
# Log a reputation signal for an agent
awp reputation signal research-bot \
  --agent-did did:key:z123 --agent-name ResearchBot \
  --dimension reliability --score 0.9 --message "Delivered on time"

# Query reputation (scores decay over time toward 0.5)
awp reputation query research-bot

# List all tracked agents
awp reputation list

# Create a delegation contract
awp contract create q3-research \
  --delegate did:key:z123 --delegate-slug research-bot \
  --description "Research LLM context window techniques"

# Evaluate a completed contract (generates reputation signals automatically)
awp contract evaluate q3-research \
  --completeness 0.9 --accuracy 0.85 --clarity 0.8 --timeliness 1.0
```

Reputation uses EWMA (exponentially weighted moving average) with time-based decay — scores degrade without new signals, confidence tracks sample size independently, and domain competence is a separate map. See [spec/rdp/rdp-spec.md](spec/rdp/rdp-spec.md) for the full specification.

## Coordination (CDP)

Organize multi-agent work with projects, tasks, and reputation-gated assignments:

```bash
# Create a project
awp project create q3-launch --title "Q3 Product Launch" --deadline 2026-04-01

# Add tasks with assignees and reputation gates
awp task create q3-launch research \
  --title "Competitive Analysis" \
  --assignee did:key:z123 --assignee-slug research-bot \
  --priority high --deadline 2026-02-15

# Create a blocked task
awp task create q3-launch positioning \
  --title "Positioning Doc" \
  --blocked-by task:q3-launch/research

# Update task status
awp task update q3-launch research --status in-progress

# Rich workspace overview
awp status

# Authority-based artifact merge (uses reputation scores)
awp artifact merge target-slug source-slug --strategy authority
```

Project members can have `minReputation` thresholds — when assigning a task, the system checks the assignee's reputation and warns if below threshold.

### Task Dependencies

Analyze task dependency graphs with topological sorting, cycle detection, and critical path analysis:

```bash
# Analyze dependencies for a project
awp task graph q3-launch

# Check for dependency cycles (exits with error if found)
awp task graph q3-launch --check

# JSON output for programmatic use
awp task graph q3-launch --json
```

## Swarms (Multi-Agent Coordination)

Compose multi-agent teams with reputation-gated role recruitment:

```bash
# Create a swarm
awp swarm create q3-launch-team \
  --name "Q3 Launch Team" \
  --goal "Complete Q3 product launch" \
  --project q3-launch

# Add roles with reputation requirements
awp swarm role add q3-launch-team researcher \
  --count 1 \
  --min-reputation reliability:0.7 \
  --min-reputation domain-competence:ai-research:0.8

awp swarm role add q3-launch-team writer \
  --count 2 \
  --min-reputation technical-writing:0.7

# Find qualified candidates from reputation profiles
awp swarm recruit q3-launch-team

# Auto-assign best qualified candidates
awp swarm recruit q3-launch-team --auto

# View swarm status
awp swarm show q3-launch-team

# List all swarms
awp swarm list
awp swarm list --status recruiting
```

Swarms automatically transition from `recruiting` to `active` status when all roles are filled. See [spec/cdp/cdp-spec.md](spec/cdp/cdp-spec.md) for the Coordination Protocol specification.

## Experiments (EXP)

Run manifesto-driven experiments with multi-agent societies:

```bash
# Create a society of 3 agents
awp experiment society create --manifesto MANIFESTO.md --agents 3 --seed 42

# Run 5 cycles
awp experiment run --society manifesto-xxx-123 --cycles 5 --manifesto MANIFESTO.md

# Use Anthropic instead of OpenAI
awp experiment run --society manifesto-xxx-123 --cycles 5 --manifesto MANIFESTO.md --provider anthropic

# List all societies
awp experiment list

# Show society details and results
awp experiment show manifesto-xxx-123
```

### Environment Variables

```bash
# For OpenAI agents (default)
export OPENAI_API_KEY=sk-xxx

# For Anthropic agents
export ANTHROPIC_API_KEY=sk-ant-xxx
```

### Moltbot / Clawdbot Integration

AWP experiments can be run through moltbot (clawdbot) for conversational access:

```bash
# Install the skill
cp -r skills/awp-experiment ~/.nvm/versions/node/*/lib/node_modules/clawdbot/skills/

# Link the CLI globally
npm link -w packages/awp-cli

# Use via clawdbot
clawdbot agent --message "Create a 3-agent AWP society"
clawdbot agent --message "Run 2 cycles on society manifesto-xxx"
```

### Programmatic Usage

```typescript
import { 
  OpenAIAgent, 
  AnthropicAgent,
  ExperimentOrchestrator, 
  SocietyManager,
  parseManifesto 
} from '@agent-workspace/agent';

// Parse manifesto
const manifesto = await parseManifesto('./MANIFESTO.md');

// Create society
const manager = new SocietyManager('./societies');
const society = await manager.createSociety('my-experiment', manifesto.id, 3);

// Create agents (OpenAI or Anthropic)
const agents = society.agents.map((ws, i) => 
  new OpenAIAgent(`agent-${i}`, ws, 'gpt-4o-mini')
  // Or: new AnthropicAgent(`agent-${i}`, ws, 'claude-sonnet-4-20250514')
);

// Run experiment
const orchestrator = new ExperimentOrchestrator(manifesto, agents, new MetricsCollector(), society);
const results = await orchestrator.runExperiment(10);

console.log(`Success rate: ${results.aggregateMetrics.overallSuccessRate * 100}%`);
```

See [packages/awp-agent/AGENT_ADAPTER.md](packages/awp-agent/AGENT_ADAPTER.md) for implementing custom agent adapters.

## File Format

AWP files are dual-format — valid Markdown with YAML frontmatter:

```markdown
---
awp: "0.4.0"
type: "soul"
vibe: "Competent, dry wit, gets stuff done"
values:
  - id: "genuine-helpfulness"
    priority: 1
    description: "Be genuinely helpful, not performatively helpful"
boundaries:
  - id: "privacy"
    rule: "Private things stay private. Period."
    severity: "hard"
governance:
  humanApprovalRequired:
    - "sending emails"
    - "posting publicly"
  autonomouslyAllowed:
    - "reading files"
    - "updating memory"
---

# SOUL.md - Who You Are

Be genuinely helpful, not performatively helpful. Skip the "Great question!"
and "I'd be happy to help!" — just help.
```

## Identity & Interop

AWP uses W3C DIDs for agent identity:

```bash
# Generate a did:key identity
awp identity generate

# Export as A2A-compatible Agent Card (JSON)
awp identity export
```

The exported Agent Card is compatible with Google's Agent-to-Agent protocol, so AWP agents can participate in A2A networks.

## Memory

Structured daily logs with machine-parseable entries:

```bash
# Log a memory entry
awp memory log --tag learning --tag architecture \
  "Discovered that the auth service uses JWT with RS256"

# Search memory
awp memory search "auth"
```

Memory entries support `pinned: true` to prevent compaction of critical knowledge.

## Knowledge Artifacts (SMP)

Versioned, provenanced knowledge documents with confidence scores:

```bash
# Create an artifact
awp artifact create llm-research --title "LLM Context Research" --tags ai,research

# Edit the markdown body, then commit the change
awp artifact commit llm-research -m "Added benchmark comparison"

# List all artifacts
awp artifact list

# Search by content, title, or tags
awp artifact search "context window"

# View provenance history
awp artifact log llm-research

# Merge one artifact into another
awp artifact merge target-slug source-slug
awp artifact merge target-slug source-slug --strategy authority
```

Artifacts track who wrote what, when, and with what confidence — full provenance for agent knowledge. See [spec/smp/smp-spec.md](spec/smp/smp-spec.md) for the Shared Memory Protocol specification.

## Specification

The full protocol specification is at [spec/awp-spec.md](spec/awp-spec.md). Sub-protocol specs: [SMP](spec/smp/smp-spec.md) (Shared Memory), [RDP](spec/rdp/rdp-spec.md) (Reputation & Delegation), [CDP](spec/cdp/cdp-spec.md) (Coordination). JSON schemas for all file types are in [spec/schemas/](spec/schemas/).

## Design Principles

1. **Dual-format** — Human-readable Markdown + machine-parseable YAML frontmatter
2. **File-native** — A workspace is a directory. Git-compatible by default
3. **Framework-agnostic** — Works with Claude Code, CrewAI, LangGraph, AutoGen, or custom agents
4. **Incrementally adoptable** — Start with just `IDENTITY.md`, add files as needed
5. **Interoperable** — DIDs, A2A Agent Cards, MCP tools

## License

Apache-2.0
