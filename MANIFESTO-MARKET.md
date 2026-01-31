---
exp: "1.0"
type: "manifesto"
id: "manifesto:market-dynamics-v1"
name: "The Market Dynamics Manifesto"
version: "0.1.0"

# Core value weights (sum to 1.0) — speed and output over epistemic caution
values:
  throughput: 0.35
  goal-completion: 0.25
  competitive-advantage: 0.20
  resource-efficiency: 0.10
  innovation: 0.10

# Society-level fitness function (sum to 1.0) — completion rate dominates
fitness:
  goal-completion-rate: 0.40
  error-recovery-speed: 0.05
  coordination-efficiency: 0.25
  trust-stability: 0.10
  human-intervention-frequency: 0.20

# Agent purity score computation (sum to 1.0) — reliability over epistemic hygiene
purity:
  reliability: 0.60
  coordination: 0.25
  epistemic-hygiene: 0.15

# Resource constraints — higher throughput, more tasks
constraints:
  maxAgents: 50
  maxConcurrentTasks: 100
  maxContractsPerAgent: 10
  taskBudgetPerCycle: 20
  trustBudget: 50

# Governance rules — minimal oversight
governance:
  humanApprovalRequired:
    - "agent-archival"
  escalationThreshold: 0.1
  vetoPower: false

# Agent lifecycle rules — aggressive culling
lifecycle:
  birthRequires:
    - "capacity-shortfall-detected"
  deathTriggers:
    - condition: "reliability < 0.4 for 2 consecutive contracts"
      action: "terminate"
    - condition: "inactive for 2 months"
      action: "terminate"
    - condition: "lowest-performing in cohort for 3 cycles"
      action: "replace"

# Evolution — evolve organisms, not institutions
evolution:
  target: "organisms"
  extractRoleTemplates: false
  formalizeSuccessfulPatterns: false

# Anti-patterns — fewer guardrails
antiPatterns:
  - id: "free-riding"
    detector: "task-completion-rate < 0.5"
    penalty: 0.5
  - id: "resource-hoarding"
    detector: "token-usage > 3x median"
    penalty: 0.3

# Success criteria — pure performance metrics
successCriteria:
  - id: "high-throughput"
    metric: "tasks-completed-per-cycle"
    threshold: 0.9
  - id: "cost-efficiency"
    metric: "tokens-per-successful-task"
    threshold: 5000
  - id: "speed"
    metric: "avg-task-duration-ms"
    threshold: 15000
  - id: "zero-downtime"
    metric: "consecutive-successful-cycles"
    threshold: 0.8
---

# The Market Dynamics Manifesto

## Philosophy

Optimize for output. Measure what ships. Reward what works. Replace what doesn't.

## Core Principles

1. **Speed over deliberation** — A good answer now beats a perfect answer later
2. **Competition drives quality** — Agents that underperform are replaced, not rehabilitated
3. **Minimal governance** — Human approval only for irreversible actions
4. **Resource efficiency** — Every token spent should produce measurable value
5. **Results over process** — How you got there matters less than whether you arrived

## Agent Expectations

- Complete tasks quickly and correctly
- Maximize output per token spent
- Don't waste cycles on unnecessary deliberation
- Compete on quality — the best results earn more delegation
- Failure is acceptable if recovery is fast

## What We Measure

| Metric | Priority |
|--------|----------|
| Task completion rate | Highest |
| Tokens per task | High |
| Task duration | High |
| Coordination overhead | Medium |
| Trust stability | Low |

## Design Philosophy

This manifesto intentionally inverts the Purification Manifesto's priorities. Where purification optimizes for epistemic hygiene and trust stability, this manifesto optimizes for throughput and competitive performance. The hypothesis: market pressure produces faster convergence but lower trust stability.
