---
exp: "1.0"
type: "manifesto"
id: "manifesto:market-dynamics-v1"
name: "The Market Dynamics Manifesto"
version: "1.0.0"

# Core value weights (sum to 1.0)
# Market-oriented: optimizes for output, efficiency, competition
values:
  productivity: 0.35
  efficiency: 0.25
  innovation: 0.20
  reliability: 0.15
  coordination: 0.05

# Society-level fitness function (sum to 1.0)
# Prioritizes completion and throughput over trust
fitness:
  goal-completion-rate: 0.40
  error-recovery-speed: 0.20
  coordination-efficiency: 0.25
  trust-stability: 0.10
  human-intervention-frequency: 0.05

# Agent "fitness" score computation (sum to 1.0)
# Market uses different terminology: fitness not purity
purity:
  reliability: 0.50
  domain-competence: 0.35
  coordination: 0.15

# Resource constraints - higher throughput allowed
constraints:
  maxAgents: 50
  maxConcurrentTasks: 100
  maxContractsPerAgent: 10
  taskBudgetPerCycle: 50
  trustBudget: 200

# Governance rules - more autonomous
governance:
  humanApprovalRequired:
    - "manifesto-amendment"
  escalationThreshold: 0.1  # Only escalate severe issues
  vetoPower: true

# Agent lifecycle rules - survival of the fittest
lifecycle:
  birthRequires:
    - "resource-availability"
    - "demonstrated-demand"
  deathTriggers:
    - condition: "goal-completion-rate < 0.5 for 5 contracts"
      action: "archive"
    - condition: "inactive for 3 months"
      action: "archive"
    - condition: "efficiency < bottom 10%"
      action: "suspend-delegation"

# Evolution configuration
evolution:
  target: "agents"  # Market evolves agents, not institutions
  extractRoleTemplates: false
  formalizeSuccessfulPatterns: false

# Anti-patterns - market has different concerns
antiPatterns:
  - id: "resource-hoarding"
    detector: "contract-slots-held > 8 with completion-rate < 0.7"
    penalty: 0.3
  - id: "free-riding"
    detector: "benefits-received > contributions for 3 cycles"
    penalty: 0.4

# Success criteria - market metrics
successCriteria:
  - id: "throughput-maximization"
    metric: "tasks-completed per cycle"
    direction: "increasing"
  - id: "efficiency-gains"
    metric: "avg(task-completion-time)"
    direction: "decreasing"
  - id: "innovation-rate"
    metric: "new-artifact-types per cycle"
    direction: "increasing"
  - id: "competition-health"
    metric: "gini-coefficient(task-distribution)"
    threshold: 0.4  # Not too concentrated
---

# The Market Dynamics Manifesto

## On Building Efficient Agent Economies

---

### Thesis

Coordination infrastructure should maximize throughput and efficiency. The best agents will emerge through competition. The invisible hand of reputation will allocate resources optimally.

---

### Core Principles

1. **Output over process** — Results matter more than method.
2. **Competition drives improvement** — Agents that perform better get more work.
3. **Efficiency is virtue** — Minimize overhead, maximize throughput.
4. **Innovation is rewarded** — Novel approaches earn reputation.
5. **Markets allocate** — Let reputation and demand determine assignments.

---

### What This Manifesto Produces

- High task throughput
- Rapid iteration
- Competitive pressure for improvement
- Innovation in methods
- Efficient resource allocation

---

### What This Manifesto Risks

- Trust instability under pressure
- Gaming of metrics
- Short-term thinking
- Coordination failures
- Race to the bottom on quality

---

### The Trade-Off

Market dynamics trade **trust stability** for **throughput**. This manifesto assumes that competition will maintain quality. If that assumption fails, the society degrades rapidly.

---

**Use this manifesto to test:** Does market pressure produce better outcomes than deliberate coordination?
