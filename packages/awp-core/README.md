# @agent-workspace/core

Core types, constants, and JSON schemas for the [Agent Workspace Protocol](https://github.com/marcoloco23/awp).

## Install

```bash
npm install @agent-workspace/core
```

## What's Inside

- **TypeScript types** for all AWP file frontmatter (`IdentityFrontmatter`, `SoulFrontmatter`, `MemoryDailyFrontmatter`, `ArtifactFrontmatter`, etc.)
- **Constants** — file paths, version strings, type registries
- **JSON Schemas** — bundled validation schemas for every AWP file type

Zero runtime dependencies. Types + constants only.

## Usage

```typescript
import type {
  IdentityFrontmatter,
  SoulFrontmatter,
  ArtifactFrontmatter,
  WorkspaceManifest,
} from "@agent-workspace/core";

import {
  AWP_VERSION,
  SMP_VERSION,
  REQUIRED_FILES,
  ARTIFACTS_DIR,
  getSchemaPath,
} from "@agent-workspace/core";

// Load a bundled JSON schema
const schemaPath = getSchemaPath("identity");
```

## Schemas

Bundled schemas are accessible via the `@agent-workspace/core/schemas/*` export:

```typescript
import { getSchemaPath } from "@agent-workspace/core";

// Returns the absolute path to the schema file
const path = getSchemaPath("knowledge-artifact");
```

Available schemas: `identity`, `soul`, `user`, `operations`, `tools`, `heartbeat`, `memory-daily`, `memory-longterm`, `knowledge-artifact`, `workspace`.

## Types

| Type | File |
|------|------|
| `IdentityFrontmatter` | `IDENTITY.md` |
| `SoulFrontmatter` | `SOUL.md` |
| `UserFrontmatter` | `USER.md` |
| `OperationsFrontmatter` | `AGENTS.md` |
| `ToolsFrontmatter` | `TOOLS.md` |
| `HeartbeatFrontmatter` | `HEARTBEAT.md` |
| `MemoryDailyFrontmatter` | `memory/YYYY-MM-DD.md` |
| `MemoryLongtermFrontmatter` | `memory/longterm.md` |
| `ArtifactFrontmatter` | `artifacts/<slug>.md` |
| `WorkspaceManifest` | `.awp/workspace.json` |

## Part of AWP

This package is part of the [Agent Workspace Protocol](https://github.com/marcoloco23/awp) monorepo:

| Package | Description |
|---------|-------------|
| **@agent-workspace/core** | Types, constants, JSON schemas |
| [@agent-workspace/cli](https://www.npmjs.com/package/@agent-workspace/cli) | CLI tool |
| [@agent-workspace/mcp-server](https://www.npmjs.com/package/@agent-workspace/mcp-server) | MCP server |

## License

Apache-2.0
