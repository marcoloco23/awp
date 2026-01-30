# AWP — Agent Workspace Protocol

The portable, open format for AI agent identity, memory, and behavior.

AWP defines what an agent **is** — its persistent state, behavioral constraints, accumulated knowledge, and reputation — in framework-agnostic, version-controlled, human-readable files.

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
| [@agent-workspace/cli](packages/awp-cli/) | CLI tool (init, validate, inspect, identity, memory) | `npm i -g @agent-workspace/cli` |
| [@agent-workspace/mcp-server](packages/awp-mcp-server/) | MCP server for any MCP-compatible client | `npm i @agent-workspace/mcp-server` |

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
- `awp_workspace_status` — Workspace summary

## File Format

AWP files are dual-format — valid Markdown with YAML frontmatter:

```markdown
---
awp: "0.1.0"
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

## Specification

The full protocol specification is at [spec/awp-spec.md](spec/awp-spec.md). JSON schemas for all file types are in [spec/schemas/](spec/schemas/).

## Design Principles

1. **Dual-format** — Human-readable Markdown + machine-parseable YAML frontmatter
2. **File-native** — A workspace is a directory. Git-compatible by default
3. **Framework-agnostic** — Works with Claude Code, CrewAI, LangGraph, AutoGen, or custom agents
4. **Incrementally adoptable** — Start with just `IDENTITY.md`, add files as needed
5. **Interoperable** — DIDs, A2A Agent Cards, MCP tools

## License

Apache-2.0
