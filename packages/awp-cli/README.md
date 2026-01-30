# @agent-workspace/cli

CLI for the [Agent Workspace Protocol](https://github.com/marcoloco23/awp) — create, validate, and manage agent workspaces from the terminal.

## Install

```bash
npm install -g @agent-workspace/cli
```

## Commands

### Workspace

```bash
# Scaffold a new agent workspace
awp init

# Validate workspace structure and schemas
awp validate

# Inspect workspace summary
awp inspect
```

### Identity

```bash
# Generate a did:key identity
awp identity generate

# Export as A2A-compatible Agent Card (JSON)
awp identity export
```

### Memory

```bash
# Log a memory entry
awp memory log --tag learning --tag architecture \
  "Discovered that the auth service uses JWT with RS256"

# Search memory
awp memory search "auth"
```

### Artifacts (SMP)

Versioned knowledge documents with provenance tracking and confidence scores.

```bash
# Create a new artifact
awp artifact create llm-research --title "LLM Context Research" --tags ai,research

# Edit the markdown body, then commit the change
awp artifact commit llm-research -m "Added benchmark comparison"

# List all artifacts
awp artifact list

# Filter by tag
awp artifact list --tag ai

# Search content, titles, and tags
awp artifact search "context window"

# View provenance history
awp artifact log llm-research

# Merge one artifact into another (additive)
awp artifact merge target-slug source-slug
```

## What It Creates

```
your-agent/
  .awp/workspace.json    # Workspace manifest
  IDENTITY.md            # Who the agent is
  SOUL.md                # How the agent behaves
  USER.md                # Human profile
  memory/                # Structured daily logs
  artifacts/             # Knowledge artifacts
```

Every file is valid Markdown with structured YAML frontmatter — human-readable and machine-parseable.

## Part of AWP

This package is part of the [Agent Workspace Protocol](https://github.com/marcoloco23/awp) monorepo:

| Package | Description |
|---------|-------------|
| [@agent-workspace/core](https://www.npmjs.com/package/@agent-workspace/core) | Types, constants, JSON schemas |
| **@agent-workspace/cli** | CLI tool |
| [@agent-workspace/mcp-server](https://www.npmjs.com/package/@agent-workspace/mcp-server) | MCP server |

## License

Apache-2.0
