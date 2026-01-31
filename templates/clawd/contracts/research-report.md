---
awp: "0.4.0"
type: "delegation-contract"
rdp: "1.0"
id: "contract:research-report"
status: "active"
delegator: "did:key:z6MkClawd"
delegate: "did:key:z6MkResearchBot"
delegateSlug: "research-bot"
created: "2026-01-25T10:00:00.000Z"
deadline: "2026-02-15T17:00:00.000Z"
task:
  description: "Research and produce a comparative analysis of agent coordination protocols across 5+ multi-agent frameworks"
  outputFormat: "Markdown report with citations"
  outputSlug: "coordination-analysis"
scope:
  include:
    - "artifacts/"
  exclude:
    - "contracts/"
    - "packages/"
constraints:
  requireCitations: true
  confidenceThreshold: 0.75
evaluation:
  criteria:
    thoroughness: 0.35
    accuracy: 0.30
    clarity: 0.20
    citations: 0.15
  result: null
---

## Contract Details

ResearchBot is tasked with producing a comparative analysis of agent coordination protocols. This report will inform AWP's protocol design decisions for Phase 6 (Experiment Protocol).

## Requirements

1. Survey at least 5 multi-agent frameworks (AutoGen, CrewAI, LangGraph, CAMEL, MetaGPT)
2. Compare coordination overhead, trust mechanisms, and task decomposition approaches
3. Include benchmark data where available
4. Provide concrete recommendations for AWP protocol extensions
5. All claims must include citations with confidence qualifiers

## Deliverables

- Primary artifact: `artifact:coordination-analysis`
- Due: 2026-02-15
