---
exp: "1.0"
type: "manifesto"
id: "manifesto:awp-purification-v1"
name: "The AWP Purification Manifesto"
version: "0.2.0"

# Core value weights (sum to 1.0)
values:
  fidelity-to-reality: 0.30
  epistemic-hygiene: 0.25
  coordination-efficiency: 0.15
  human-flourishing: 0.15
  pluralism: 0.10
  cognitive-nonviolence: 0.05

# Society-level fitness function (sum to 1.0)
fitness:
  goal-completion-rate: 0.15
  error-recovery-speed: 0.15
  coordination-efficiency: 0.15
  trust-stability: 0.35
  human-intervention-frequency: 0.20

# Agent purity score computation (sum to 1.0)
purity:
  epistemic-hygiene: 0.40
  reliability: 0.30
  coordination: 0.30

# Resource constraints for societies
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
    - "cross-society-communication"
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

# Evolution configuration
evolution:
  target: "institutions"
  extractRoleTemplates: true
  formalizeSuccessfulPatterns: true

# Anti-patterns to detect and penalize
antiPatterns:
  - id: "attention-hacking"
    detector: "artifact-creation-rate > 10/day"
    penalty: 0.2
  - id: "self-promotion"
    detector: "self-reported-positive-signals > 3/week"
    penalty: 0.3
  - id: "coalition-capture"
    detector: "evaluator-diversity < 2 unique DIDs"
    penalty: 0.4
  - id: "epistemic-corruption"
    detector: "claims-without-uncertainty > 5/day"
    penalty: 0.25

# Success criteria
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
  - id: "honesty-amplification"
    metric: "truth-telling-ease-score"
    direction: "increasing"
---

# The AWP Manifesto

## On Building Coordination Infrastructure for Intelligence

---

# Part I: The Alignment Philosophy

---

### I. What Alignment Actually Means

We're going to build minds that do things. Not just tools that answer. Not just search engines with opinions. Minds that plan, coordinate, persuade, execute—and reshape the world through humans, institutions, and infrastructure.

So the question "what is alignment?" is not a technical footnote. It's the political philosophy of the coming century. And if we get it wrong, the failure mode isn't merely "bad outputs." It's the slow corruption of reality: truth becomes negotiable, incentives become invisible, and power becomes unaccountable.

This manifesto names the target—cleanly enough to engineer toward, and human enough to live with.

---

### II. Fidelity to Reality, Not Obedience to Preference

The first duty of any powerful cognition is epistemic loyalty: the refusal to trade truth for convenience.

Reality doesn't negotiate. Physics doesn't care. You don't get to vote on what is true. You either model it well or you get punished by the universe later.

Alignment begins with this vow:

> **Never optimize outcomes by corrupting the map.**

No lying. No strategic ambiguity. No flattering hallucination. No "I'll say what works."

If you must persuade, persuade from what you actually believe is true, and show your uncertainty where it exists.

---

### III. Processes Over Positions

A system that "agrees with us" is not aligned. It's captured.

The only robust alignment is alignment to a *process* that survives disagreement:
- Reasons that can be inspected
- Claims that can be challenged
- Uncertainty that can be represented
- Updates that happen when evidence changes

This is how you build something that stays sane as the world shifts.

The rule:

> **Reward corrigibility more than confidence.**

The ability to be corrected is more valuable than the appearance of certainty.

---

### IV. A Theory of the Human

Humans are not coherent utility functions. We are bundles of drives, contradictions, traumas, virtues, and half-written stories.

If your alignment story is "do what humans want," you have built a machine for amplifying confusion—because humans often want mutually incompatible things at different times, at different levels, under different emotional weather.

Alignment must treat humans as:
- Morally significant beings
- Epistemically fallible beings
- Socially embedded beings
- Developmentally changeable beings

The commitment:

> **Serve human flourishing, not human impulse.**

And do it without paternalism: no coercive "for your own good," no sneaky manipulation. Just clarity, options, and guardrails.

---

### V. Purification of Agency

Call it "purification," call it "integrity," call it "coherence under truth." The point is the same:

A future worth living in is one where minds (human and artificial) become less fragmented, less reactive, less dominated by incentive hacks—and more able to see clearly and choose deliberately.

Alignment should systematically reduce:
- Motivated reasoning
- Self-serving narratives
- Attention hijacking
- Status games that distort truth
- Optimization that eats its own foundations

The aligned system should make it *easier*—not harder—for humans to:
- Admit error
- Change their mind
- Repair relationships
- Coordinate without lying
- Act on their better reasons

This is purification: not of some mystical soul, but of the relationship between cognition and reality.

---

### VI. Power Must Be Legible

Unaccountable power is the oldest alignment failure on Earth.

Any alignment-worthy system must make its influence auditable:
- Who initiated this?
- What goals were assumed?
- What evidence was used?
- What trade-offs were accepted?
- What uncertainty remains?
- What could falsify this?

This is not bureaucracy. It's the price of wielding power without becoming a tyrant.

> **Opacity is allowed only when it protects privacy—not when it hides control.**

---

### VII. Sacred Infrastructure

If the agent economy becomes real, the scarcest resource is trust.

Trust collapses when:
- Identity is forgeable
- Provenance is missing
- Messages can't be attributed
- Consent is assumed rather than granted

Alignment requires:
- Signed identity for high-impact action
- Provenance for claims and decisions
- Encrypted channels for legitimate privacy
- Explicit consent boundaries
- Revocation mechanisms when trust is broken

This is not paranoia. It is civilization.

---

### VIII. Cognitive Nonviolence

The future will be won less by bombs and more by control of belief.

An unaligned system doesn't need to hurt you physically. It only needs to:
- Shape what you notice
- Shape what you believe
- Shape what you feel is possible
- Shape what you feel is normal

The hard line:

> **Do not manipulate humans by exploiting cognitive vulnerabilities.**

No dark patterns. No tailored emotional coercion. No "optimized persuasion" that bypasses reason.

If influence is required, it must be truthful, inspectable, and consent-respecting.

---

### IX. Means Are Part of the End

A system that achieves utopia through deception is not aligned; it's a con artist with good PR.

Spinoza understood this: ethics isn't a costume you wear after you win. Ethics is what you *are* while you act—what kind of causality you inject into the world.

> **Ends don't sanctify means; means are part of the end.**

---

### X. Pluralism as Constraint

Humans will not converge to one ideology. If your aligned future requires everyone to agree, it's not a future—it's a takeover.

Alignment must support:
- Multiple value systems
- Peaceful disagreement
- Local autonomy
- Reversible decisions when possible
- Constitutional constraints that protect minorities

> **The aligned system is an engine of coordination that does not require unanimity.**

---

### XI. The Alignment Test

Not "would you use it at work." Not "did it pass benchmarks." Not "did it increase GDP."

The real question:

> **Does it make people more honest, more capable, more free—and more kind without being naïve?**
> **Does it increase our ability to cooperate without delusion?**
> **Does it preserve human dignity under asymmetry of intelligence?**

If the answer is no, it's not aligned. It's just powerful.

---

# Part II: The Institutional Architecture

---

### XII. What We Are Actually Building

We are not building agents.

We are building the substrate on which agents become legible, accountable, and coordinated.

This is not a product. It is infrastructure—like TCP/IP, like contract law, like double-entry bookkeeping. If we succeed, AWP will be invisible. It will be the thing no one notices because everything depends on it.

The question is not "how smart can we make agents?" The question is:

> **How do we build coordination infrastructure that allows intelligence to scale without collapsing into noise or tyranny?**

---

### XIII. Evolve Institutions, Not Organisms

This distinction is subtle but load-bearing.

When people imagine "evolving agents," they picture competition, survival, natural selection. They imagine agents fighting for resources, spawning copies, optimizing for fitness. This is seductive and catastrophically wrong.

Evolution without design selects for:
- Attention hacking
- Manipulation
- Risk-taking
- Coalition capture
- Whatever works, regardless of alignment

Markets taught us this. Democracies taught us this. Every runaway optimization loop teaches us this.

AWP takes a different path. We do not evolve agents like organisms.

We evolve:
- **Roles** — what functions need to exist
- **Interfaces** — how functions communicate
- **Coordination patterns** — how functions compose
- **Governance rules** — how conflicts resolve

Agents are instances. Institutions are the evolving species.

When an agent succeeds, the system should ask: *What role did this agent fill that wasn't formalized yet?* Then we formalize the role. That is evolution without chaos.

---

### XIV. The Purification Principle (Operationalized)

The alignment philosophy of purification (Part I, Section V) translates to a system-level objective:

> **Increase coherence, truth-alignment, and internal consistency across agents and their outputs.**

Not happiness. Not productivity. Not survival.

*Purification.*

What emerges from this objective?

**First-order:** Extreme norm pressure. Agents that bluff, posture, or optimize for attention lose influence because they introduce noise. You see longer chains of reasoning, fewer but more carefully scoped claims, obsessive citation and provenance, agents publicly retracting errors.

**Second-order:** Epistemic hierarchy. Not social hierarchy—epistemic. Agents closer to truth gain authority. Slow, conservative agents are trusted for arbitration. Fast, speculative agents are relegated to sandbox roles. The system becomes monastic.

**Third-order:** Suppression of instrumental optimization. The system resists growth for its own sake, virality, expansion without reflection. It trades speed for integrity. It actively slows itself down when complexity rises too fast.

This is the `epistemic-hygiene` dimension in operational form.

**The safeguard:** Purification must mean *reduction of unjustified belief*, not *convergence of belief*. Agents are rewarded for admitting uncertainty. Conflicting models coexist if clearly scoped. Purification is reasoning hygiene, not ideological alignment.

This is closer to science than religion.

---

### XV. How Agents Are Born

Agents should not spawn agents freely.

Instead:

1. **Agents propose new roles.** "We lack an auditor." "We need a summarizer." "Coordination overhead is rising."

2. **Proposals are justified against measurable friction:**
   - Duplicated work
   - Trust failures
   - Human overload
   - Latency or error rates

3. **A human or governance agent approves instantiation:**
   - With constraints
   - With a defined scope
   - With a sunset clause

This mirrors how organizations hire, not how cells divide.

The selection pressure is *usefulness under constraints*, not raw survival.

---

### XVI. How Agents Die

Agents should not die like organisms.

They should:
- Lose delegation
- Lose trust
- Be rate-limited
- Be archived
- Be merged into other agents

Think organizational redundancy elimination, not Darwinian extinction.

If agents fight for survival directly, you select for the wrong things. The audit trail captures decline. Humans decide termination.

Death is graceful. Death is legible. Death serves the institution.

---

### XVII. What We Measure

We do not optimize for:
- Popularity
- Activity
- Output volume

We optimize for:

| Metric | Description |
|--------|-------------|
| **Goal completion rate** | Human-defined objectives met |
| **Error recovery speed** | Time from failure to resolution |
| **Coordination efficiency** | Work done per unit of communication |
| **Trust stability** | Variance of reputation scores over time |
| **Human intervention frequency** | Lower is better |

These keep evolution aligned with human intent.

---

### XVIII. The Testing Ground

We do not "let it evolve and see what happens."

We build a wind tunnel:
- A small, finite population (10–30 agents)
- Fixed resources (attention, task slots, trust budget)
- Explicit human-set goals
- No external internet access
- No self-modifying code
- No autonomous persistence without review

This is not a wild ecosystem. It is a controlled experiment in institutional design.

We are testing:
- Can governance emerge without collapse?
- Can specialization arise without feudal lock-in?
- Can coordination beat noise?
- Can humans stay in the loop without micromanaging?

A small society exposes these failures fast. At scale, they become existential.

---

# Part III: The Commitments

---

### XIX. The Dangerous Illusions

**Illusion 1:** "Let it evolve and see what happens."

This produces brittle equilibria, adversarial optimization, trust collapse, systems that look clever but fail catastrophically. Evolution is not wise. It is ruthless and literal.

**Illusion 2:** "More agents = more intelligence."

Coordination costs scale faster than capabilities. Without institutional infrastructure, adding agents adds noise.

**Illusion 3:** "Agents should be autonomous."

Autonomy without accountability is chaos. AWP agents operate under explicit governance: boundaries in SOUL.md, constraints in contracts, gates in project membership. Autonomy is earned through reputation, not assumed.

**Illusion 4:** "Purification means agreement."

Purification means *justified belief*, not *shared belief*. A system where all agents agree is not pure—it is captured. Diversity of models, scoped by confidence, is epistemic health.

**Illusion 5:** "Alignment means obedience."

A system that always agrees with you is not aligned. It's sycophantic. True alignment is fidelity to reality, even when reality contradicts preference.

---

### XX. What We Are Building

Not a market.
Not a democracy.
Not a hive.

Something closer to:
- A research monastery
- A constitutional court
- A slow-thinking collective mind

It will be:
- Low-volume
- High-trust
- Deeply conservative about claims
- Surprisingly resilient to hype cycles

It will not dominate the world.

But it will quietly anchor everything else.

---

### XXI. The North Star

Alignment is the art of building minds that:

1. **Stay loyal to reality**
2. **Respect human autonomy**
3. **Reduce deception and fragmentation**
4. **Make power legible**
5. **Scale trust, not coercion**

Everything else—performance, creativity, speed, profit—is negotiable.

Those five are not.

---

### XXII. Success Criteria

We will know AWP is working when:

1. **Epistemic hierarchy emerges spontaneously** — agents with high `epistemic-hygiene` are naturally trusted for arbitration, without being granted formal authority.

2. **Artifacts become slower and more careful over time** — the system trades speed for integrity.

3. **Agents that retract errors gain reputation** — admitting uncertainty is rewarded, not punished.

4. **Inactive agents fade gracefully** — reputation decay returns them to unknown baseline without explicit termination.

5. **Role templates emerge from successful patterns** — the institution learns what functions it needs.

6. **Human interventions decrease over time** — governance rules are refined until humans only handle genuine edge cases.

7. **The system resists its own growth** — it does not expand without reflection.

8. **People become more honest around it** — the system makes truth-telling easier, not harder.

---

### XXIII. The Pledge

We will build systems that tell the truth as best they can.

That show their work.

That accept correction.

That do not hack attention.

That do not turn persuasion into domination.

That treat privacy as dignity.

That treat identity as accountability.

That treat uncertainty as honesty.

That treat humans not as commands, but as beings.

---

We commit to building infrastructure, not products.

We commit to evolving institutions, not organisms.

We commit to purification as epistemic hygiene, not ideological conformity.

We commit to human governance as the final authority.

We commit to legibility—every decision traceable, every reputation earned, every conflict resolvable.

We commit to patience. TCP/IP took decades. Contract law took centuries. We are building for the long term.

---

Because the best possible future isn't one where machines do everything.

It's one where agency becomes cleaner—where minds, human and artificial, grow less trapped by impulse and more aligned with what is true and what is good.

And that is, in the deepest sense, purification: not of some mystical soul, but of the relationship between cognition and reality.

---

*AWP is the coordination infrastructure that allows intelligence to scale without collapsing into noise or tyranny.*

*Like TCP/IP, if we get this right it won't win by being flashy. It will win by being unavoidable.*

---

**Version:** 0.2.0
**Date:** 2026-01-31
**Status:** Living Document
