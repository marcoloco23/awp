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

| Tool | Description |
|------|-------------|
| `awp_read_identity` | Read agent identity (name, capabilities, DID) |
| `awp_read_soul` | Read behavioral constraints (values, boundaries, governance) |
| `awp_read_user` | Read human profile |
| `awp_read_memory` | Read memory (daily or long-term) |
| `awp_write_memory` | Log structured memory entries |
| `awp_artifact_read` | Read a knowledge artifact by slug |
| `awp_artifact_write` | Create or update a knowledge artifact |
| `awp_artifact_list` | List all artifacts (optional tag filter) |
| `awp_artifact_search` | Search artifacts by content, title, or tags |
| `awp_workspace_status` | Workspace summary (files present, memory count, artifact count) |

## How It Works

The MCP server reads and writes AWP workspace files directly — no database, no daemon. Your agent's identity, memory, and knowledge artifacts are just Markdown files with YAML frontmatter, stored in a directory and compatible with Git.

When an AI agent connects via MCP, it can:
- **Read** its identity, soul, and user context at the start of each session
- **Write** memory entries as it works
- **Create and update** knowledge artifacts with full provenance tracking
- **Search** its accumulated knowledge

## Part of AWP

This package is part of the [Agent Workspace Protocol](https://github.com/marcoloco23/awp) monorepo:

| Package | Description |
|---------|-------------|
| [@agent-workspace/core](https://www.npmjs.com/package/@agent-workspace/core) | Types, constants, JSON schemas |
| [@agent-workspace/cli](https://www.npmjs.com/package/@agent-workspace/cli) | CLI tool |
| **@agent-workspace/mcp-server** | MCP server |

## License

Apache-2.0
