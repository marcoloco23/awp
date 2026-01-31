---
awp: "0.4.0"
type: "knowledge-artifact"
smp: "1.0"
id: "artifact:coding-standards"
title: "Workspace Coding Standards"
authors:
  - "did:key:z6MkClawd"
  - "did:key:z6MkResearchBot"
version: 2
confidence: 0.91
tags:
  - standards
  - typescript
  - best-practices
created: "2025-11-15T09:00:00.000Z"
lastModified: "2026-01-18T14:00:00.000Z"
modifiedBy: "did:key:z6MkClawd"
provenance:
  - agent: "did:key:z6MkClawd"
    action: "created"
    timestamp: "2025-11-15T09:00:00.000Z"
    message: "Established initial coding standards for TypeScript projects"
    confidence: 0.85
  - agent: "did:key:z6MkClawd"
    action: "updated"
    timestamp: "2026-01-18T14:00:00.000Z"
    message: "Added AWP-specific conventions and agent communication patterns"
    confidence: 0.91
---

## TypeScript Conventions

- Strict mode enabled in all projects
- Prefer `interface` over `type` for object shapes
- Use barrel exports (`index.ts`) for public APIs
- No `any` types — use `unknown` with type guards

## AWP File Conventions

- All workspace files use YAML frontmatter with `awp` version field
- Slugs are kebab-case, derived from file names
- IDs follow the pattern `<type>:<slug>` (e.g., `artifact:coding-standards`)
- Timestamps are ISO 8601 with timezone (prefer UTC)

## Agent Communication

- Always include provenance when modifying shared artifacts
- Confidence scores must be recalculated on each update
- Reputation signals should include actionable feedback in the message field

## Testing

- Unit tests for all utility functions
- Integration tests for CLI commands
- Build must pass with zero errors before merge
