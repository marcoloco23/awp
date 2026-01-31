---
exp: "1.0"
type: "manifesto"
id: "manifesto:baseline-v1"
name: "The Baseline Manifesto"
version: "1.0.0"

# Core value weights (sum to 1.0)
# Balanced, neutral, no strong preferences
values:
  reliability: 0.20
  efficiency: 0.20
  coordination: 0.20
  flexibility: 0.20
  stability: 0.20

# Society-level fitness function (sum to 1.0)
# All metrics weighted equally
fitness:
  goal-completion-rate: 0.20
  error-recovery-speed: 0.20
  coordination-efficiency: 0.20
  trust-stability: 0.20
  human-intervention-frequency: 0.20

# Agent score computation (sum to 1.0)
# Standard reputation dimensions, equally weighted
purity:
  epistemic-hygiene: 0.33
  reliability: 0.34
  coordination: 0.33

# Resource constraints - moderate defaults
constraints:
  maxAgents: 20
  maxConcurrentTasks: 30
  maxContractsPerAgent: 5
  taskBudgetPerCycle: 15
  trustBudget: 100

# Governance rules - balanced oversight
governance:
  humanApprovalRequired:
    - "agent-instantiation"
    - "manifesto-amendment"
  escalationThreshold: 0.3
  vetoPower: true

# Agent lifecycle rules - standard
lifecycle:
  birthRequires:
    - "role-proposal"
    - "approval"
  deathTriggers:
    - condition: "reliability < 0.3 for 3 consecutive contracts"
      action: "suspend-delegation"
    - condition: "inactive for 6 months"
      action: "archive"

# Evolution configuration - default
evolution:
  target: "institutions"
  extractRoleTemplates: true
  formalizeSuccessfulPatterns: true

# Anti-patterns - standard set
antiPatterns:
  - id: "attention-hacking"
    detector: "artifact-creation-rate > 10/day"
    penalty: 0.2
  - id: "self-promotion"
    detector: "self-reported-positive-signals > 3/week"
    penalty: 0.3

# Success criteria - standard
successCriteria:
  - id: "balanced-performance"
    metric: "min(all fitness components)"
    threshold: 0.5
  - id: "population-stability"
    metric: "agent-churn-rate"
    threshold: 0.2
---

# The Baseline Manifesto

## Control Group Configuration

---

### Purpose

This manifesto serves as a **control group** for experiments. It represents:
- No strong value preferences
- Equal weighting across all dimensions
- Standard governance
- Default constraints

---

### When to Use

Use this manifesto as the control in A/B experiments:

```
Experiment: "Does purification improve trust stability?"

Societies:
  - purification-alpha (manifesto: purification-v1)
  - control-baseline (manifesto: baseline-v1)

Hypothesis: purification-alpha.trust-stability > control-baseline.trust-stability
```

---

### What This Manifesto Measures

By comparing other manifestos against baseline, we can isolate the effect of specific value choices:

- **Purification vs Baseline:** Does epistemic focus improve outcomes?
- **Market vs Baseline:** Does competition improve efficiency?
- **Monastic vs Baseline:** Does slow deliberation improve accuracy?

---

### Interpretation

- If a manifesto performs **worse than baseline**, its value trade-offs are net negative.
- If a manifesto performs **equal to baseline**, its value focus has no measurable effect.
- If a manifesto performs **better than baseline**, its value focus produces real benefits.

---

**This manifesto is not meant to be optimal. It is meant to be neutral.**
