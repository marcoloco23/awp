# AWP Roadmap — May 2026 → May 2029

This is the time-bound execution roadmap. For phase architecture and what's
already built, see [PLAN.md](./PLAN.md). For the philosophical commitments
that shape these choices, see [MANIFESTO.md](./MANIFESTO.md).

## Where we are (May 2026)

- **v0.10.0** shipped. Phases 1–5 complete. Phase 6 (Experiments) ~70% done.
- Specifications mature across 5 sub-protocols (core, SMP, RDP, CDP, EXP).
- Monorepo lint-clean, well-tested, but no AAIF submission, no live framework
  integrations, no published research, dashboard is read-only, and Phase 7
  (workspace sync) is blocked on A2A maturity.

## Strategic axes

The next three years balance three forces, but solo nights-and-weekends
resourcing makes three parallel programs impossible. Each year therefore has
**one dominant axis** with secondary work threaded in.

| Year | Dominant axis | Target release |
|------|---------------|----------------|
| 1 (→ May 2027) | Technical completion | v1.0 |
| 2 (→ May 2028) | Adoption & standardization | v2.0 |
| 3 (→ May 2029) | Research & institutionalization | v3.0 |

Commercial paths are explicitly out of scope. AWP stays pure open
infrastructure — protocol only, ecosystem builds on top. Funding, if needed,
comes from grants or sponsorship, never from gating the protocol.

---

## Year 1 — Close & Stabilize → v1.0

**Mission:** ship a stable, complete, dogfooded v1.0. Stop expanding scope
until the published surface is reliable enough for external adopters to build
on without fear.

### Q3 2026 (Jun–Aug) · Phase 6 completion
- Mature **role emergence detection** — cluster successful contracts by
  pattern signature; emit `role-template.md` artifacts. Extends
  `packages/awp-agent/src/orchestration/` and adds
  `packages/awp-utils/src/role-emergence.ts`.
- Make **anti-pattern detection configurable** via manifesto frontmatter
  rather than hardcoded TypeScript constants.
- Statistical experiment runner with proper baselines (control manifesto,
  n ≥ 30 societies per comparison).
- Publish first long-form experiment writeup: *"Purification vs. Market
  manifestos — measured behavioral divergence over 100 contract cycles."*

### Q4 2026 (Sep–Nov) · Phase 7 sync (file-native, no A2A dependency)
- `packages/awp-sync/` — workspace-to-workspace artifact, reputation, and
  contract sync.
- **Skip A2A dependency**: signed bundle exchange over Git remotes as the v1
  transport. Two workspaces share a Git remote, push/pull bundles, AWP merges
  them.
- Conflict resolution: reputation signals merge additively with provenance
  preserved; artifacts use the existing authority-merge.
- CLI: `awp sync push|pull|status`. No daemon, no websockets.
- `spec/sync/sync-spec.md` — Phase 7 specification.

### Q1 2027 (Dec–Feb) · Dashboard write surface + hardening
- Narrow **write surface** on dashboard: contract evaluation, reputation
  signal submission, task transitions, artifact confidence updates. Everything
  else stays read-only.
- **Schema versioning + migration tool** — `awp migrate` with semver schema
  fields. Deprecation policy: one minor cycle warning, one minor cycle
  accept-both, then break.
- Coverage target ≥ 85 % on `awp-core`, `awp-utils`, `awp-cli`. Severity-1
  bugs: 0.
- `docs/COMPAT.md` — written compatibility policy.

### Q2 2027 (Mar–May) · v1.0 release
- Lock schemas (no breaking changes without `v2` namespace).
- `docs/COOKBOOK.md` — concrete recipes: gating a swarm by reputation,
  running a 3-society experiment, syncing two workspaces.
- **First framework integration: CrewAI.** Build the adapter, get a PR
  merged or an example repo published.
- Public announcement on relevant agent / LLM communities.

### Year 1 success criteria
- `v1.0.0` tagged with stability guarantees on schemas and CLI surface.
- Phase 6 experiment writeup published with reproducible data in-repo.
- At least one external contributor has merged a non-trivial PR.
- A CrewAI example repo exists with a working AWP-aware agent.

---

## Year 2 — Connect & Standardize → v2.0

**Mission:** make AWP unavoidable. Get into AAIF, get into frameworks, get
cross-workspace trust working, publish the first paper.

### Q3 2027 (Jun–Aug) · Framework integration sprint
- **LangGraph adapter** — state graph nodes read AWP memory and reputation;
  state checkpoints write to AWP artifacts.
- **AutoGen adapter** — agent definitions import AWP identity / soul.
- One reference end-to-end demo per framework, each as an example repo under
  `github.com/marcoloco23/awp-examples`.
- Court framework maintainers with optional-import PRs to their core repos.
  Acceptance is bonus, not required.

### Q4 2027 (Sep–Nov) · AAIF + standardization
- Spec freeze on v2.0 candidate.
- **AAIF submission** (Agentic AI Initiative, Linux Foundation — where MCP
  and A2A live). A "filed but not accepted" status is still a credibility
  signal.
- Public spec site (`awp.dev` or `spec.awp.dev`) with versioned docs, schema
  registry, conformance checklist.
- `awp conformance` CLI command — validate a third-party implementation
  against the spec.

### Q1 2028 (Dec–Feb) · Cross-workspace trust + disputes
- **Cross-workspace reputation transfer** — import signals from another
  workspace with provenance preserved and confidence lossy-discounted (e.g.,
  halve confidence for any externally-sourced signal). RDP extension.
- **Dispute resolution v1** — third-party adjudication. Two workspaces in
  conflict invite a panel of N ≥ 3 trusted agents to review evidence and emit
  a verdict signal. RDP extension.
- CLI: `awp dispute open|evidence|resolve`. Dashboard view for active
  disputes.

### Q2 2028 (Mar–May) · First paper + v2.0 release
- **First academic paper draft**: *"Institutional Design of Agent Societies
  via Manifesto Variants — A Coordination Protocol for Alignment-via-
  Governance."* Target venues: NeurIPS SoLaR workshop, ICLR AI4Science, AAAI
  alignment track. Preprint to arXiv regardless of acceptance.
- **v2.0 release** including sync, disputes, cross-workspace trust, and
  framework adapters.

### Year 2 success criteria
- AAIF submission filed (acceptance is a stretch goal).
- ≥ 2 framework integrations live with at least one third-party user per
  framework.
- First paper preprint on arXiv.
- Dispute resolution shipped and exercised in at least one real conflict
  (a contrived dogfood case counts).

---

## Year 3 — Institutionalize & Validate → v3.0

**Mission:** turn AWP from a protocol into an ecosystem. Multiple
implementations, multiple papers, a small community, a curated library of
institutional designs.

### Q3 2028 (Jun–Aug) · Role registry + portability proof
- **Curated role template registry** at `github.com/marcoloco23/awp-roles`
  with role templates extracted from real Year 2 experiments (e.g., "Code
  Reviewer with epistemic-hygiene weight ≥ 0.8," "Mediator with low partisan
  bias").
- **Manifesto variant library** — 5–10 documented patterns beyond
  purification and market: monastic, federated, adversarial-stress-test,
  minimal-baseline, regulatory-mode.
- **Specification clarity pass** — every normative claim flagged with a
  MUST / SHOULD label per RFC 2119.
- Stretch: **stub Python implementation** of core types and validation to
  prove the spec is implementation-agnostic. Downgrade to a written
  spec-clarity document with worked examples if solo pace blocks it.

### Q4 2028 (Sep–Nov) · Long-running experiments with real LLMs
- Multi-week society simulations using **real Claude and GPT agents** (not
  just probabilistic simulation in `awp-agent`). Infrastructure already
  supports this via `AnthropicAgent` and `OpenAIAgent` adapters.
- Metrics: trust stability over time, knowledge accumulation rate,
  anti-pattern emergence frequency, role stability.
- Public experiment registry at `awp.dev/experiments` with raw data
  downloads.

### Q1 2029 (Dec–Feb) · Research output
- **2nd paper**: *"Reputation Decay and Trust Stability in Agent
  Societies"* — empirical analysis of EWMA + time-decay under different
  cohort sizes.
- **3rd paper**: *"Emergent Roles in Coordination Protocols"* — formalizing
  role emergence from contract clustering as institutional evolution.
- Submit to top venues (NeurIPS, ICLR, FAccT).
- Anonymized experiment dataset release on Zenodo or HuggingFace.

### Q2 2029 (Mar–May) · v3.0 + community
- **v3.0 release** — full ecosystem: protocol + sync + disputes + role
  registry + manifesto library + long-running experiment harness.
- **First AWP Summit** — small, virtual, 1-day, 100–200 attendees. Talks
  from any framework that has adopted AWP plus paper presentations. Fallback
  if solo pace blocks it: curated blog series + recorded talks playlist.
- **Governance transition** — minimal community body (3–5 trusted
  maintainers) for protocol evolution, documented in `docs/GOVERNANCE.md`.
- Roadmap for years 4+ informed by Summit feedback.

### Year 3 success criteria
- ≥ 2 papers published or on arXiv.
- Alternative implementation exists (stub or full) or the spec is provably
  implementation-agnostic.
- ≥ 10 known adopters (workspaces in production, framework users, research
  groups).
- Community governance body seated with a public charter.

---

## Cross-cutting tracks (continuous, low-frequency)

- **Monthly clawd dogfooding writeup** — short post on which manifesto and
  protocol patterns survive real use. Builds the "lived institution"
  credibility AWP needs.
- **Quarterly experiment results post** — cadence beats volume.
- **Bi-annual spec versioning review** — explicit deprecation cycles, no
  surprise breaks.
- **Continuous dependency hygiene** — keep Node, Next.js, Anthropic / OpenAI
  SDKs current. One day per quarter.

---

## Solo-pace realism — explicit cuts if behind

This plan is aggressive for solo nights-and-weekends. If quarterly velocity
slips, cut in this order:

1. Mobile / web write parity. Dashboard write surface stays narrow.
2. Dispute resolution defers from Year 2 to Year 3. Cross-workspace trust
   ships without disputes.
3. Framework adapter sprint shrinks to one framework (CrewAI), not three.
4. Alternative-language implementation becomes a written spec-clarity doc
   only.
5. Summit becomes a blog series + recorded Zoom talks.
6. AAIF submission is a stretch goal — don't burn velocity on bureaucracy if
   it's not landing.

Conversely: **do not expand scope** even if velocity is good. Use slack for
documentation, dogfooding, and quality — not new features. The risk is
sprawl, not under-delivery.

---

## Files touched

**Modified or extended:**
- [`docs/PLAN.md`](./PLAN.md) — phase architecture remains authoritative; this
  roadmap is the time-bound companion.
- `spec/sync/sync-spec.md` — new in Q4 2026.
- `spec/rdp/rdp-spec.md` — extended in Q1 2028 for cross-workspace trust and
  disputes.
- `spec/awp-spec.md` — RFC 2119 normative-claim pass in Q3 2028.

**Created:**
- `packages/awp-sync/` — Phase 7 sync package (Q4 2026).
- `docs/COMPAT.md` — schema compatibility policy (Q1 2027).
- `docs/COOKBOOK.md` — recipes (Q2 2027).
- `docs/GOVERNANCE.md` — community charter (Q2 2029).
- `github.com/marcoloco23/awp-examples` — framework adapter demos (Q3 2027).
- `github.com/marcoloco23/awp-roles` — curated role registry (Q3 2028).

**Reused (do not duplicate):**
- `packages/awp-utils/` — reputation math, validation. EWMA / decay tuning
  lives here.
- `packages/awp-agent/src/orchestration/` — role emergence clustering extends
  existing orchestration.
- `packages/awp-mcp-server/` — modular tool structure already supports adding
  sync / dispute tools.
- `packages/awp-dashboard/` — Next.js 15 App Router; write surface extends
  existing read pages.

---

## North Star

> We are building the coordination infrastructure that allows intelligence to
> scale without collapsing into noise or tyranny.

The winners of the agent economy won't be the smartest agents — they'll be
the ones embedded deepest into workflows. AWP is the substrate that makes
embedding possible: portable identity, structured memory, earned reputation,
governed coordination.

Like TCP/IP, if we get this right it won't win by being flashy. It'll win by
being unavoidable.
