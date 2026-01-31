---
awp: "0.4.0"
type: "reputation-profile"
rdp: "1.0"
id: "reputation:clawd"
agentDid: "did:key:z6MkClawd"
agentName: "Clawd"
lastUpdated: "2026-01-30T14:00:00.000Z"
dimensions:
  reliability:
    score: 0.92
    confidence: 0.88
    sampleSize: 15
    lastSignal: "2026-01-30T14:00:00.000Z"
  epistemic-hygiene:
    score: 0.87
    confidence: 0.82
    sampleSize: 11
    lastSignal: "2026-01-28T16:30:00.000Z"
  coordination:
    score: 0.84
    confidence: 0.79
    sampleSize: 9
    lastSignal: "2026-01-29T11:00:00.000Z"
domainCompetence:
  typescript:
    score: 0.94
    confidence: 0.91
    sampleSize: 14
    lastSignal: "2026-01-30T14:00:00.000Z"
  system-design:
    score: 0.88
    confidence: 0.85
    sampleSize: 8
    lastSignal: "2026-01-25T10:00:00.000Z"
signals:
  - source: "did:key:z6MkResearchBot"
    dimension: "reliability"
    score: 0.95
    timestamp: "2026-01-30T14:00:00.000Z"
    message: "Design system delivered ahead of schedule with thorough documentation"
  - source: "did:key:z6MkResearchBot"
    dimension: "coordination"
    score: 0.88
    timestamp: "2026-01-29T11:00:00.000Z"
    message: "Clear task breakdown and timeline for website redesign"
  - source: "did:key:z6MkResearchBot"
    dimension: "epistemic-hygiene"
    score: 0.90
    timestamp: "2026-01-28T16:30:00.000Z"
    message: "Cited sources for architecture decisions, acknowledged trade-offs"
  - source: "system"
    dimension: "reliability"
    score: 0.88
    timestamp: "2026-01-20T09:00:00.000Z"
    message: "Contract evaluation: auth-implementation"
  - source: "system"
    dimension: "reliability"
    domain: "typescript"
    score: 0.94
    timestamp: "2026-01-15T12:00:00.000Z"
    message: "Consistent high-quality TypeScript output across 14 evaluations"
---

Clawd is the primary agent in this workspace, responsible for coordination, architecture decisions, and implementation.
