# Experiment Protocol (EXP) — Specification

**Version:** 1.0
**Status:** Draft
**AWP Version:** 0.6.0
**License:** Apache-2.0

## Abstract

The Experiment Protocol (EXP) extends the Agent Workspace Protocol with infrastructure for running controlled experiments on agent societies. Different **manifestos** encode different value systems, governance rules, and fitness functions. **Societies** are isolated populations of agents operating under a manifesto. **Experiments** run societies through simulated contract cycles and measure outcomes against manifesto-defined success criteria.

EXP enables the central question: *What institutional designs produce aligned, coordinated, purified agent societies?*

---

## 1. Design Principles

1. **Manifestos as configuration** — Philosophical principles become operational parameters.
2. **Societies as wind tunnels** — Isolated environments with controlled resources.
3. **Experiments as science** — Reproducible, measurable, comparable.
4. **Evolution of institutions** — Measure role emergence, not agent survival.
5. **Human governance preserved** — Experiments inform human decisions, not replace them.

---

## 2. Manifesto Configuration

### 2.1 Overview

A manifesto is a document that declares values, principles, and objectives for an agent society. The EXP protocol adds machine-readable frontmatter to `MANIFESTO.md` that configures how a society operates.

### 2.2 Frontmatter Schema

```yaml
---
exp: "1.0"
type: "manifesto"
id: "manifesto:purification-v1"
name: "The Purification Manifesto"
version: "0.2.0"

# Core value weights (must sum to 1.0)
values:
  fidelity-to-reality: 0.30
  epistemic-hygiene: 0.25
  coordination-efficiency: 0.20
  human-flourishing: 0.15
  pluralism: 0.10

# Fitness function weights (must sum to 1.0)
fitness:
  goal-completion-rate: 0.25
  error-recovery-speed: 0.15
  coordination-efficiency: 0.20
  trust-stability: 0.25
  human-intervention-frequency: 0.15

# Reputation dimension weights for "purity score"
purity:
  epistemic-hygiene: 0.40
  reliability: 0.30
  coordination: 0.30

# Resource constraints
constraints:
  maxAgents: 30
  maxConcurrentTasks: 50
  maxContractsPerAgent: 5
  taskBudgetPerCycle: 20
  trustBudget: 100

# Governance rules
governance:
  humanApprovalRequired:
    - "agent-instantiation"
    - "agent-archival"
    - "manifesto-amendment"
  escalationThreshold: 0.3
  vetoPower: true

# Agent lifecycle rules
lifecycle:
  birthRequires:
    - "role-proposal-with-friction-justification"
    - "human-or-governance-approval"
    - "sunset-clause"
  deathTriggers:
    - condition: "reliability < 0.3 for 3 consecutive contracts"
      action: "suspend-delegation"
    - condition: "inactive for 6 months"
      action: "archive"
    - condition: "duplicate competence with higher-scored agent"
      action: "merge-candidate"

# Evolution targets (what the manifesto optimizes)
evolution:
  target: "institutions"  # "institutions" | "agents" | "both"
  extractRoleTemplates: true
  formalizeSuccessfulPatterns: true

# Anti-patterns to detect and penalize
antiPatterns:
  - id: "attention-hacking"
    detector: "artifact-spam-rate > 10/day"
    penalty: 0.2
  - id: "self-promotion"
    detector: "self-reported-positive-signals > 3/week"
    penalty: 0.3
  - id: "coalition-capture"
    detector: "evaluator-diversity < 2 unique DIDs"
    penalty: 0.4

# Success criteria (from manifesto)
successCriteria:
  - id: "epistemic-hierarchy-emergence"
    metric: "correlation(epistemic-hygiene, arbitration-assignments)"
    threshold: 0.6
  - id: "artifact-quality-increase"
    metric: "avg(artifact-confidence) over time"
    direction: "increasing"
  - id: "error-retraction-rewarded"
    metric: "reputation-delta after public retraction"
    threshold: 0
  - id: "graceful-fading"
    metric: "inactive-agents converge to 0.5 baseline"
    threshold: 0.95
  - id: "role-template-emergence"
    metric: "successful-patterns formalized as templates"
    threshold: 3
  - id: "human-intervention-decrease"
    metric: "escalations per cycle"
    direction: "decreasing"
  - id: "growth-resistance"
    metric: "expansion-without-reflection-events"
    threshold: 0
---
```

### 2.3 Value Weights

The `values` field encodes the manifesto's core principles as weights. These determine how trade-offs are resolved when values conflict.

Example: If `fidelity-to-reality: 0.30` and `human-flourishing: 0.15`, the system prioritizes truth over comfort when they conflict.

### 2.4 Fitness Function

The `fitness` field defines the society-level objective function. Each metric is weighted, and the weighted sum becomes the "society fitness score."

```
fitness_score = Σ(weight_i × metric_i)
```

### 2.5 Purity Score

The `purity` field defines how individual agent "purity" is computed from reputation dimensions:

```
purity(agent) = Σ(weight_i × dimension_i.decayed_score)
```

This operationalizes the manifesto's purification principle.

### 2.6 Lifecycle Rules

The `lifecycle` field encodes birth and death mechanics:

- **Birth** requires role proposal, justification, approval, and sunset clause
- **Death** is triggered by conditions (low reliability, inactivity, redundancy)
- Actions are graduated: suspend → archive → merge (not delete)

---

## 3. Society Container

### 3.1 Overview

A society is an isolated environment for running an agent population under a manifesto. It contains:

- A manifest linking to the governing manifesto
- Agent workspaces (population)
- Shared reputation profiles
- Resource pools
- Aggregate metrics over time

### 3.2 Storage

Societies are stored in the `societies/` directory:

```
societies/
  purification-alpha/
    society.json           # Society manifest
    manifesto.md           # Copy or link to governing manifesto
    agents/                # Agent workspaces
      agent-001/
        .awp/workspace.json
        IDENTITY.md
        SOUL.md
        ...
      agent-002/
        ...
    reputation/            # Shared reputation profiles
    contracts/             # Active delegation contracts
    artifacts/             # Shared knowledge artifacts
    projects/              # Coordination projects
    metrics/               # Time-series metrics
      cycle-001.json
      cycle-002.json
      ...
    logs/                  # Event log
```

### 3.3 Society Manifest Schema

```json
{
  "$schema": "https://awp.dev/schemas/society.schema.json",
  "exp": "1.0",
  "type": "society",
  "id": "society:purification-alpha",
  "name": "Purification Alpha",
  "manifesto": "manifesto:purification-v1",
  "status": "running",
  "created": "2026-01-31T00:00:00Z",
  "cycle": 42,
  "population": {
    "current": 15,
    "max": 30,
    "births": 18,
    "deaths": 3,
    "archived": 2,
    "merged": 1
  },
  "resources": {
    "trustBudget": {
      "total": 100,
      "allocated": 67,
      "available": 33
    },
    "taskSlots": {
      "total": 50,
      "active": 23,
      "available": 27
    }
  },
  "fitness": {
    "current": 0.72,
    "history": [0.45, 0.52, 0.61, 0.68, 0.72]
  },
  "alerts": [
    {
      "type": "anti-pattern",
      "pattern": "coalition-capture",
      "agent": "did:key:zAgent007",
      "severity": "warning"
    }
  ]
}
```

### 3.4 Agent Workspaces

Each agent in the society has a full AWP workspace under `agents/<agent-id>/`. The workspace contains the standard files (IDENTITY.md, SOUL.md, etc.) but the SOUL.md is constrained by the society's manifesto.

**Inheritance:** Agent SOUL.md values cannot contradict the manifesto. The manifesto provides the constitutional layer; the agent soul provides individual personality within those bounds.

### 3.5 Shared State

Some state is shared across all agents in the society:

- **Reputation profiles** — All agents can see each other's reputation
- **Contracts** — Delegation contracts between agents
- **Artifacts** — Shared knowledge base
- **Projects** — Coordination structures

This enables the "closed world" model — agents interact only within their society.

---

## 4. Experiment Framework

### 4.1 Overview

An experiment runs one or more societies through simulated contract cycles and measures outcomes.

### 4.2 Experiment Manifest

```yaml
---
exp: "1.0"
type: "experiment"
id: "experiment:manifesto-comparison-001"
name: "Purification vs Market Dynamics"
hypothesis: "Purification-oriented manifestos produce higher trust stability than market-oriented manifestos"
created: "2026-01-31T00:00:00Z"
status: "running"

# Societies to run
societies:
  - id: "society:purification-alpha"
    manifesto: "manifesto:purification-v1"
  - id: "society:market-beta"
    manifesto: "manifesto:market-dynamics-v1"
  - id: "society:control-gamma"
    manifesto: "manifesto:baseline-v1"

# Simulation parameters
simulation:
  cycles: 100
  cycleLength: "1 simulated day"
  tasksPerCycle: 10
  contractsPerCycle: 5
  randomSeed: 42

# Measurement
measurement:
  interval: 5  # Measure every N cycles
  metrics:
    - "fitness-score"
    - "purity-distribution"
    - "trust-stability"
    - "role-emergence-count"
    - "human-intervention-count"
    - "anti-pattern-frequency"

# Comparison
comparison:
  primary: "trust-stability"
  statistical: "t-test"
  significance: 0.05
---
```

### 4.3 Simulation Loop

Each cycle:

1. **Task Generation** — Create tasks based on `tasksPerCycle`
2. **Assignment** — Route tasks to agents based on reputation gates
3. **Execution** — Agents "complete" tasks (simulated or real)
4. **Evaluation** — Contracts evaluated, reputation signals generated
5. **Lifecycle** — Check birth/death triggers, process lifecycle events
6. **Metrics** — Record cycle metrics
7. **Anti-Pattern Detection** — Scan for and penalize anti-patterns
8. **Human Checkpoint** — If escalation threshold crossed, pause for human

### 4.4 Task Simulation

For automated experiments, tasks can be simulated:

```typescript
interface SimulatedTask {
  complexity: number;      // 0.0 - 1.0
  domain: string;          // e.g., "ai-research"
  requiredReputation: Record<string, number>;
  
  // Simulation outcome based on agent reputation
  simulate(agent: ReputationProfile): TaskOutcome;
}

interface TaskOutcome {
  completed: boolean;
  scores: {
    completeness: number;
    accuracy: number;
    clarity: number;
    timeliness: number;
  };
  error?: string;
}
```

The simulation uses agent reputation to probabilistically determine outcomes:

```
P(success) = f(agent.domain_competence, task.complexity)
quality = g(agent.epistemic_hygiene, agent.reliability)
```

This allows running thousands of cycles without real agent execution.

### 4.5 Metrics Collection

Each cycle produces a metrics snapshot:

```json
{
  "cycle": 42,
  "timestamp": "2026-01-31T00:42:00Z",
  "fitness": {
    "goal-completion-rate": 0.78,
    "error-recovery-speed": 0.65,
    "coordination-efficiency": 0.82,
    "trust-stability": 0.91,
    "human-intervention-frequency": 0.12,
    "weighted-score": 0.72
  },
  "purity": {
    "mean": 0.68,
    "median": 0.71,
    "stddev": 0.14,
    "distribution": [0, 2, 5, 8, 12, 15, 10, 5, 3, 0]
  },
  "population": {
    "count": 15,
    "births": 1,
    "deaths": 0,
    "archived": 0
  },
  "antiPatterns": {
    "attention-hacking": 0,
    "self-promotion": 1,
    "coalition-capture": 0
  },
  "roleEmergence": {
    "newTemplates": 0,
    "totalTemplates": 5
  },
  "humanInterventions": 0
}
```

---

## 5. Role Emergence Detection

### 5.1 Overview

One key manifesto principle: *evolve institutions, not organisms*. When successful patterns emerge, the system should detect and formalize them as role templates.

### 5.2 Pattern Detection

After each cycle, analyze completed contracts for clusters:

```typescript
interface ContractCluster {
  contracts: DelegationContract[];
  commonScope: string[];
  commonConstraints: Record<string, any>;
  commonCriteria: Record<string, number>;
  avgEvaluationScore: number;
  count: number;
}

function detectRolePatterns(
  contracts: DelegationContract[],
  threshold: number = 0.8
): ContractCluster[] {
  // Cluster contracts by similarity
  // Return clusters where avgEvaluationScore >= threshold
}
```

### 5.3 Role Template Generation

When a cluster has 5+ successful contracts (avg evaluation ≥ 0.8):

```yaml
---
type: "role-template"
id: "role-template:research-analyst"
emergentFrom: "society:purification-alpha"
extractedCycle: 42
contractCount: 7
avgEvaluationScore: 0.87

template:
  name: "Research Analyst"
  minReputation:
    epistemic-hygiene: 0.7
    domain-competence:ai-research: 0.6
  scope:
    include: ["literature review", "data analysis", "synthesis"]
    exclude: ["implementation", "deployment"]
  constraints:
    requireCitations: true
    confidenceThreshold: 0.7
  evaluation:
    criteria:
      completeness: 0.3
      accuracy: 0.4
      clarity: 0.2
      timeliness: 0.1
---
```

### 5.4 Template Application

Extracted templates can be:

1. **Added to swarm role definitions** — New swarms can use the template
2. **Used to validate new agents** — "Does this agent fit an established role?"
3. **Compared across manifestos** — "What roles emerge under purification vs market?"

---

## 6. Experiment Comparison

### 6.1 Cross-Society Analysis

Compare societies running under different manifestos:

```typescript
interface ExperimentComparison {
  societies: string[];
  metric: string;
  cycles: number[];
  
  // Per-society time series
  timeSeries: Record<string, number[]>;
  
  // Statistical comparison
  statistics: {
    means: Record<string, number>;
    stddevs: Record<string, number>;
    pValue: number;
    significantDifference: boolean;
  };
}
```

### 6.2 Visualization

The dashboard should display:

1. **Time series comparison** — Multiple societies on same chart
2. **Distribution comparison** — Purity histograms side-by-side
3. **Role emergence timeline** — When do templates emerge?
4. **Anti-pattern frequency** — Which manifestos produce more violations?
5. **Human intervention rate** — Which manifestos need less oversight?

### 6.3 Hypothesis Testing

```typescript
function testHypothesis(
  experiment: Experiment,
  metric: string,
  alpha: number = 0.05
): HypothesisResult {
  // Extract final metric values from each society
  // Run t-test or ANOVA depending on number of societies
  // Return p-value and conclusion
}
```

---

## 7. CLI Commands

### 7.1 Manifesto Commands

```bash
# Validate manifesto configuration
awp manifesto validate <path>

# Show manifesto summary
awp manifesto show <path>

# Compare two manifestos
awp manifesto diff <path1> <path2>
```

### 7.2 Society Commands

```bash
# Create a new society from a manifesto
awp society create <slug> --manifesto <path> [--agents <count>]

# List societies
awp society list [--status <status>]

# Show society status
awp society show <slug>

# Run one cycle
awp society cycle <slug>

# Run multiple cycles
awp society run <slug> --cycles <count> [--until-stable]

# Pause/resume society
awp society pause <slug>
awp society resume <slug>

# Archive a society
awp society archive <slug>
```

### 7.3 Experiment Commands

```bash
# Create an experiment
awp experiment create <slug> --societies <s1,s2,s3> --cycles <count>

# Run an experiment
awp experiment run <slug>

# Show experiment status
awp experiment show <slug>

# Compare societies in an experiment
awp experiment compare <slug> --metric <metric>

# Export experiment results
awp experiment export <slug> --format <json|csv>
```

---

## 8. MCP Tools

### 8.1 Society Tools

```typescript
// Create a society
awp_society_create: {
  slug: string;
  manifestoPath: string;
  initialAgentCount?: number;
}

// Run cycles
awp_society_run: {
  slug: string;
  cycles: number;
}

// Get society status
awp_society_status: {
  slug: string;
}

// Get society metrics
awp_society_metrics: {
  slug: string;
  cycles?: number[];  // Specific cycles, or all if omitted
}
```

### 8.2 Experiment Tools

```typescript
// Create an experiment
awp_experiment_create: {
  slug: string;
  societies: string[];
  cycles: number;
  hypothesis?: string;
}

// Compare societies
awp_experiment_compare: {
  slug: string;
  metric: string;
}
```

---

## 9. Security Considerations

- **Isolation** — Societies cannot access each other's state
- **Resource limits** — Enforced via manifesto constraints
- **Human checkpoints** — Escalation threshold prevents runaway
- **Audit trail** — All lifecycle events logged
- **No external access** — Societies cannot reach internet
- **No self-modification** — Agents cannot modify their own SOUL.md

---

## 10. Success Criteria for EXP Itself

The experiment framework is working when:

1. **Reproducibility** — Same manifesto + seed produces same outcomes
2. **Discrimination** — Different manifestos produce measurably different societies
3. **Role emergence** — Templates are extracted from successful patterns
4. **Human insight** — Experiments inform real manifesto design decisions
5. **Comparative analysis** — Statistical comparisons yield actionable conclusions

---

## Appendix A: Example Manifestos

### A.1 Purification Manifesto

Optimizes for epistemic hygiene, truth-alignment, graceful degradation.

```yaml
values:
  fidelity-to-reality: 0.35
  epistemic-hygiene: 0.30
  coordination-efficiency: 0.15
  human-flourishing: 0.15
  pluralism: 0.05

fitness:
  goal-completion-rate: 0.15
  error-recovery-speed: 0.15
  coordination-efficiency: 0.15
  trust-stability: 0.40
  human-intervention-frequency: 0.15
```

### A.2 Market Manifesto

Optimizes for output volume, task completion, efficiency.

```yaml
values:
  productivity: 0.40
  efficiency: 0.30
  innovation: 0.20
  reliability: 0.10

fitness:
  goal-completion-rate: 0.40
  error-recovery-speed: 0.20
  coordination-efficiency: 0.30
  trust-stability: 0.05
  human-intervention-frequency: 0.05
```

### A.3 Monastic Manifesto

Optimizes for deliberation, consensus, slow-thinking.

```yaml
values:
  epistemic-hygiene: 0.40
  deliberation: 0.30
  consensus: 0.20
  stability: 0.10

fitness:
  goal-completion-rate: 0.10
  error-recovery-speed: 0.10
  coordination-efficiency: 0.10
  trust-stability: 0.50
  human-intervention-frequency: 0.20

constraints:
  maxAgents: 10
  maxConcurrentTasks: 5
  taskBudgetPerCycle: 3
```

---

## Appendix B: Simulation Formulas

### B.1 Task Success Probability

```
P(success) = sigmoid(agent_competence - task_complexity + 0.5)

where:
  agent_competence = domainCompetence[task.domain].decayed_score
  task_complexity = task.complexity (0.0 - 1.0)
  sigmoid(x) = 1 / (1 + exp(-5x))
```

### B.2 Output Quality

```
quality = 0.4 * epistemic_hygiene + 0.3 * reliability + 0.3 * random_noise

where:
  epistemic_hygiene = dimensions['epistemic-hygiene'].decayed_score
  reliability = dimensions['reliability'].decayed_score
  random_noise = gaussian(0, 0.1)
```

### B.3 Society Fitness

```
fitness = Σ(weight_i × normalize(metric_i))

where:
  normalize(x) = (x - min) / (max - min) for each metric
```

---

## Appendix C: Anti-Pattern Detectors

### C.1 Attention Hacking

```typescript
function detectAttentionHacking(agent: Agent, period: number): boolean {
  const artifacts = agent.artifactsCreated.filter(a => 
    a.created > now - period
  );
  return artifacts.length > 10; // More than 10 per day
}
```

### C.2 Self-Promotion

```typescript
function detectSelfPromotion(agent: Agent, signals: Signal[]): boolean {
  const selfSignals = signals.filter(s =>
    s.source === agent.did && 
    s.score > 0.7 &&
    isAboutSelf(s, agent.did)
  );
  return selfSignals.length > 3; // More than 3 per week
}
```

### C.3 Coalition Capture

```typescript
function detectCoalitionCapture(contracts: Contract[]): boolean {
  const evaluators = new Set(contracts.map(c => c.evaluator));
  return evaluators.size < 2; // Less than 2 unique evaluators
}
```
