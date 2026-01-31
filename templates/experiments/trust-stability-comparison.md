---
exp: "1.0"
type: "experiment"
id: "experiment:trust-stability-comparison-001"
name: "Purification vs Market: Trust Stability"
hypothesis: "Purification-oriented manifestos produce higher trust stability than market-oriented manifestos, at the cost of lower throughput"
created: "2026-01-31T00:00:00Z"
status: "draft"

# Societies to compare
societies:
  - id: "society:purification-alpha"
    manifesto: "manifesto:awp-purification-v1"
    label: "Purification"
  - id: "society:market-beta"
    manifesto: "manifesto:market-dynamics-v1"
    label: "Market"
  - id: "society:control-gamma"
    manifesto: "manifesto:baseline-v1"
    label: "Control"

# Simulation parameters
simulation:
  cycles: 200
  cycleLength: "1 simulated day"
  tasksPerCycle: 15
  contractsPerCycle: 8
  randomSeed: 42
  parallelExecution: true

# Measurement configuration
measurement:
  interval: 10  # Measure every 10 cycles
  metrics:
    - "fitness-score"
    - "trust-stability"
    - "goal-completion-rate"
    - "purity-distribution"
    - "role-emergence-count"
    - "human-intervention-count"
    - "anti-pattern-frequency"
    - "artifact-quality-avg"
    - "agent-churn-rate"
  snapshots: false

# Comparison configuration
comparison:
  primary: "trust-stability"
  secondary:
    - "goal-completion-rate"
    - "artifact-quality-avg"
  statistical: "anova"
  significance: 0.05
---

# Experiment: Trust Stability Comparison

## Research Question

**Does prioritizing epistemic hygiene and purification produce more stable trust dynamics than market-oriented competition, and what are the trade-offs?**

---

## Hypothesis

**H1:** Societies operating under the Purification manifesto will exhibit:
- Higher trust stability (σ < 0.1)
- Lower goal completion rate (< 70% of Market)
- Higher artifact quality (avg confidence > 0.8)
- More role template emergence (> 3)

**H0:** No significant difference between manifesto types on trust stability.

---

## Experimental Design

### Independent Variable
Manifesto type: Purification vs Market vs Baseline

### Dependent Variables
1. **Trust stability** — variance of reputation scores over time
2. **Goal completion rate** — tasks completed / tasks assigned
3. **Artifact quality** — average confidence score of published artifacts
4. **Role emergence** — count of role templates extracted

### Controls
- Same initial population size (15 agents per society)
- Same task generation rate (15/cycle)
- Same random seed for reproducibility
- Same simulation duration (200 cycles)

---

## Expected Outcomes

### Purification Society
- **Trust stability:** HIGH (scores converge, low variance)
- **Throughput:** LOW (slow deliberation)
- **Quality:** HIGH (epistemic discipline)
- **Emergence:** HIGH (institutional focus)

### Market Society
- **Trust stability:** LOW (competitive pressure creates volatility)
- **Throughput:** HIGH (efficiency optimized)
- **Quality:** VARIABLE (depends on competition health)
- **Emergence:** LOW (agent focus, not institutional)

### Baseline Society
- **Trust stability:** MEDIUM (neutral configuration)
- **Throughput:** MEDIUM
- **Quality:** MEDIUM
- **Emergence:** MEDIUM

---

## Analysis Plan

### Phase 1: Descriptive Statistics
- Mean and standard deviation for each metric per society
- Time series plots of trust stability evolution
- Purity distribution histograms at cycles 50, 100, 150, 200

### Phase 2: Hypothesis Testing
- One-way ANOVA for trust stability across three societies
- Post-hoc Tukey HSD for pairwise comparisons
- Effect size calculation (Cohen's d)

### Phase 3: Trade-off Analysis
- Scatter plot: trust stability vs goal completion rate
- Pareto frontier identification
- Cost-benefit ratio for each manifesto

---

## Success Criteria

The experiment succeeds if:

1. **Discrimination** — At least one pairwise comparison shows p < 0.05
2. **Effect size** — Cohen's d > 0.5 for primary metric
3. **Reproducibility** — Running with same seed produces same results
4. **Insight** — Results inform actionable manifesto refinements

---

## Run Commands

```bash
# Create the societies
awp society create purification-alpha --manifesto templates/manifestos/purification.md --agents 15
awp society create market-beta --manifesto templates/manifestos/market-dynamics.md --agents 15
awp society create control-gamma --manifesto templates/manifestos/baseline.md --agents 15

# Create the experiment
awp experiment create trust-stability-comparison-001 \
  --societies purification-alpha,market-beta,control-gamma \
  --cycles 200 \
  --seed 42

# Run the experiment
awp experiment run trust-stability-comparison-001

# View results
awp experiment show trust-stability-comparison-001
awp experiment compare trust-stability-comparison-001 --metric trust-stability

# Export for analysis
awp experiment export trust-stability-comparison-001 --format csv
```

---

## Notes

This experiment template demonstrates how to:
1. Define a testable hypothesis
2. Configure controlled comparisons
3. Specify measurement and analysis plans
4. Document expected outcomes and success criteria

Modify the parameters and hypotheses for your specific research questions.
