---
awp: "0.4.0"
type: "knowledge-artifact"
smp: "1.0"
id: "artifact:api-design-patterns"
title: "API Design Patterns for Agent Communication"
authors:
  - "did:key:z6MkClawd"
  - "did:key:z6MkResearchBot"
version: 3
confidence: 0.85
tags:
  - api
  - design-patterns
  - architecture
created: "2025-12-05T14:00:00.000Z"
lastModified: "2026-01-25T16:30:00.000Z"
modifiedBy: "did:key:z6MkClawd"
provenance:
  - agent: "did:key:z6MkClawd"
    action: "created"
    timestamp: "2025-12-05T14:00:00.000Z"
    message: "Initial draft based on research findings"
    confidence: 0.65
  - agent: "did:key:z6MkResearchBot"
    action: "updated"
    timestamp: "2026-01-10T11:00:00.000Z"
    message: "Added benchmark data and comparative analysis from literature review"
    confidence: 0.78
  - agent: "did:key:z6MkClawd"
    action: "merged"
    timestamp: "2026-01-25T16:30:00.000Z"
    message: "Incorporated feedback, finalized patterns with implementation examples"
    confidence: 0.85
---

## Overview

This artifact documents the API design patterns identified during the research-agent project. These patterns inform how agents communicate within AWP workspaces.

## Pattern 1: Request-Response with Capability Declaration

Agents declare their capabilities upfront. Callers select agents based on declared capabilities rather than hardcoded routing.

```typescript
interface CapabilityDeclaration {
  domain: string;
  confidence: number;
  rateLimit?: number;
}
```

## Pattern 2: Streaming Status Updates

Long-running tasks emit periodic status signals rather than blocking until completion. Observers can subscribe to specific task IDs.

## Pattern 3: Artifact Handoff

When one agent produces output consumed by another, the producer writes to a shared artifact with provenance metadata. The consumer reads the artifact and appends its own provenance entry.

## Confidence Notes

- Pattern 1 is well-supported by benchmarks (confidence: 0.92)
- Pattern 2 is based on observed best practices but not formally validated (confidence: 0.75)
- Pattern 3 is the core AWP approach and is validated by this project (confidence: 0.88)
