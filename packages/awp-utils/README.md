# @agent-workspace/utils

Shared utilities for the [Agent Workspace Protocol](https://github.com/marcoloco23/awp) packages.

## Installation

```bash
npm install @agent-workspace/utils
```

## Usage

### Validation

```typescript
import { validateSlug, sanitizeSlug, validatePath } from "@agent-workspace/utils";

// Validate a slug
validateSlug("my-artifact"); // true
validateSlug("Invalid_Slug"); // false

// Sanitize and validate (throws on invalid)
const slug = sanitizeSlug("My-Artifact"); // "my-artifact"

// Validate path is within root (prevents traversal)
const safePath = validatePath("/workspace", "artifacts/doc.md");
```

### Reputation

```typescript
import {
  computeDecayedScore,
  updateDimension,
  computeConfidence,
} from "@agent-workspace/utils";

// Compute decayed score (decays toward 0.5 over time)
const decayed = computeDecayedScore(dimension, new Date());

// Update dimension with new signal using EWMA
const updated = updateDimension(existingDimension, 0.9);

// Compute confidence from sample size
const confidence = computeConfidence(10); // ~0.5
```

### Frontmatter

```typescript
import {
  parseWorkspaceFile,
  writeWorkspaceFile,
  serializeWorkspaceFile,
} from "@agent-workspace/utils";
import type { IdentityFrontmatter } from "@agent-workspace/core";

// Parse a workspace file
const identity = await parseWorkspaceFile<IdentityFrontmatter>("IDENTITY.md");
console.log(identity.frontmatter.name);

// Modify and write back
identity.frontmatter.lastModified = new Date().toISOString();
await writeWorkspaceFile(identity);
```

## Part of AWP

This package is part of the [Agent Workspace Protocol](https://github.com/marcoloco23/awp) monorepo:

| Package | Description |
|---------|-------------|
| [@agent-workspace/core](https://www.npmjs.com/package/@agent-workspace/core) | Types, constants, JSON schemas |
| [@agent-workspace/cli](https://www.npmjs.com/package/@agent-workspace/cli) | CLI tool |
| [@agent-workspace/mcp-server](https://www.npmjs.com/package/@agent-workspace/mcp-server) | MCP server |
| **@agent-workspace/utils** | Shared utilities |

## License

Apache-2.0
