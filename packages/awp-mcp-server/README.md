# @agent-workspace/mcp-server

MCP server for the [Agent Workspace Protocol](https://github.com/marcoloco23/awp) — plug any AWP workspace into Claude Code, Cursor, or any MCP-compatible client.

## Setup

### Claude Code

```bash
claude mcp add awp-workspace -- npx @agent-workspace/mcp-server
```

### With a specific workspace path

```bash
AWP_WORKSPACE=/path/to/workspace npx @agent-workspace/mcp-server
```

### Generic MCP client

The server communicates over stdio using the [Model Context Protocol](https://modelcontextprotocol.io). Point any MCP client at:

```bash
npx @agent-workspace/mcp-server
```

It will auto-discover the AWP workspace from the current directory (or use `AWP_WORKSPACE` env var).

## Tools

### Core Identity & Context

| Tool | Description |
|------|-------------|
| `awp_read_identity` | Read agent identity (name, capabilities, DID) |
| `awp_read_soul` | Read behavioral constraints (values, boundaries, governance) |
| `awp_read_user` | Read human profile |
| `awp_read_agents` | Read operations config (AGENTS.md) |
| `awp_read_tools` | Read tools config (TOOLS.md) |
| `awp_read_heartbeat` | Read heartbeat config (HEARTBEAT.md) |

### Memory Operations

| Tool | Description |
|------|-------------|
| `awp_read_memory` | Read memory (daily, longterm, or recent logs) |
| `awp_write_memory` | Log structured memory entries to daily log |

### Knowledge Artifacts (SMP)

| Tool | Description |
|------|-------------|
| `awp_artifact_read` | Read a knowledge artifact by slug |
| `awp_artifact_write` | Create or update a knowledge artifact with versioning |
| `awp_artifact_list` | List all artifacts (optional tag filter) |
| `awp_artifact_search` | Search artifacts by content, title, or tags |

### Reputation (RDP)

| Tool | Description |
|------|-------------|
| `awp_reputation_query` | Query reputation profiles with time-based decay applied |
| `awp_reputation_signal` | Log reputation signals (uses EWMA with decay) |

### Delegation Contracts (RDP)

| Tool | Description |
|------|-------------|
| `awp_contract_create` | Create delegation contracts between agents |
| `awp_contract_evaluate` | Evaluate contracts and generate reputation signals |
| `awp_contract_list` | List all contracts with optional status filter |

### Workspace Management

| Tool | Description |
|------|-------------|
| `awp_workspace_status` | Workspace health check (files present, stats) |

## How It Works

The MCP server reads and writes AWP workspace files directly — no database, no daemon. Your agent's identity, memory, knowledge artifacts, and reputation profiles are just Markdown files with YAML frontmatter, stored in a directory and compatible with Git.

When an AI agent connects via MCP, it can:
- **Read** its identity, soul, and user context at the start of each session
- **Write** memory entries as it works
- **Create and update** knowledge artifacts with full provenance tracking
- **Search** its accumulated knowledge
- **Query and update** reputation profiles for itself and other agents
- **Create and evaluate** delegation contracts for multi-agent coordination

## Part of AWP

This package is part of the [Agent Workspace Protocol](https://github.com/marcoloco23/awp) monorepo:

| Package | Description |
|---------|-------------|
| [@agent-workspace/core](https://www.npmjs.com/package/@agent-workspace/core) | Types, constants, JSON schemas |
| [@agent-workspace/cli](https://www.npmjs.com/package/@agent-workspace/cli) | CLI tool |
| **@agent-workspace/mcp-server** | MCP server |

## License

Apache-2.0
