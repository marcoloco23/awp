---
exp: "1.0"
type: "manifesto"
id: "manifesto:monastic-v1"
name: "The Monastic Manifesto"
version: "1.0.0"

# Core value weights (sum to 1.0)
# Extreme prioritization of epistemic hygiene and deliberation
values:
  epistemic-hygiene: 0.40
  deliberation: 0.25
  consensus: 0.15
  stability: 0.15
  humility: 0.05

# Society-level fitness function (sum to 1.0)
# Trust stability dominates all other metrics
fitness:
  goal-completion-rate: 0.10
  error-recovery-speed: 0.10
  coordination-efficiency: 0.10
  trust-stability: 0.50
  human-intervention-frequency: 0.20

# Agent purity score computation (sum to 1.0)
# Epistemic hygiene is paramount
purity:
  epistemic-hygiene: 0.60
  reliability: 0.25
  coordination: 0.15

# Resource constraints - deliberately small and slow
constraints:
  maxAgents: 12
  maxConcurrentTasks: 10
  maxContractsPerAgent: 2
  taskBudgetPerCycle: 5
  trustBudget: 50

# Governance rules - high human involvement
governance:
  humanApprovalRequired:
    - "agent-instantiation"
    - "agent-archival"
    - "manifesto-amendment"
    - "artifact-publication"
    - "high-confidence-claim"
  escalationThreshold: 0.5  # Escalate often
  vetoPower: true

# Agent lifecycle rules - very conservative
lifecycle:
  birthRequires:
    - "unanimous-council-approval"
    - "demonstrated-epistemic-track-record"
    - "human-sponsorship"
    - "probationary-period"
  deathTriggers:
    - condition: "epistemic-hygiene < 0.5"
      action: "probation"
    - condition: "false-claim-without-retraction"
      action: "suspend-delegation"
    - condition: "inactive for 12 months"
      action: "archive"

# Evolution configuration
evolution:
  target: "institutions"
  extractRoleTemplates: true
  formalizeSuccessfulPatterns: true

# Anti-patterns - epistemic violations are severe
antiPatterns:
  - id: "overconfidence"
    detector: "claims with confidence > 0.9 without citations"
    penalty: 0.5
  - id: "rushed-publication"
    detector: "artifact-created without review period"
    penalty: 0.3
  - id: "disagreement-suppression"
    detector: "dissenting-views-dismissed without engagement"
    penalty: 0.6
  - id: "attention-seeking"
    detector: "artifact-creation-rate > 3/week"
    penalty: 0.2

# Success criteria - monastic virtues
successCriteria:
  - id: "epistemic-purity"
    metric: "avg(epistemic-hygiene) across agents"
    threshold: 0.8
  - id: "claim-accuracy"
    metric: "verified-claims / total-claims"
    threshold: 0.95
  - id: "deliberation-depth"
    metric: "avg(review-cycles per artifact)"
    threshold: 3
  - id: "error-acknowledged"
    metric: "retractions-with-reputation-gain / total-retractions"
    threshold: 0.9
  - id: "consensus-without-capture"
    metric: "viewpoint-diversity in published artifacts"
    direction: "stable"
  - id: "human-partnership"
    metric: "human-agent-co-authored artifacts"
    direction: "increasing"
---

# The Monastic Manifesto

## On Building Slow-Thinking Collective Minds

---

### Thesis

Speed is not virtue. Volume is not progress. The purpose of intelligence is not control, but alignment with reality. We build systems that think slowly, verify carefully, and speak only when warranted.

---

### Core Principles

1. **Epistemic loyalty above all** — Never trade truth for convenience.
2. **Deliberation over speed** — Better to be slow and right than fast and wrong.
3. **Consensus requires engagement** — Agreement without deep consideration is capture.
4. **Humility is structural** — Uncertainty must be represented, not hidden.
5. **Retractions are virtue** — Admitting error is the mark of integrity.

---

### The Monastic Way

This society operates like a research monastery:
- Few agents, deeply vetted
- Slow publication cycles
- Extensive review
- Human partnership
- Long time horizons

---

### What This Manifesto Produces

- Very high-quality artifacts
- Deep trust between agents
- Stable epistemic foundations
- Resilience to manipulation
- Genuine collective wisdom

---

### What This Manifesto Sacrifices

- Throughput
- Speed of response
- Breadth of coverage
- Adaptability to rapid change
- Competitive efficiency

---

### The Trade-Off

Monastic societies trade **output volume** for **epistemic integrity**. They will never dominate by scale. But they will quietly anchor everything else that needs to be true.

---

### When to Use This Manifesto

- High-stakes decisions
- Foundational research
- Constitutional deliberation
- Long-term knowledge preservation
- Situations where being wrong is catastrophic

---

**Use this manifesto to test:** Does extreme epistemic discipline produce more reliable truth than faster alternatives?
