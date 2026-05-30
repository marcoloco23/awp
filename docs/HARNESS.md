# AWP and Harness Engineering

> Where AWP sits in an agent-first world: the portable **state** layer beneath
> the **runtime** (the harness). For phase architecture see
> [`PLAN.md`](./PLAN.md); for the roadmap see [`ROADMAP.md`](./ROADMAP.md).

## What "harness engineering" means

As coding agents took over more of the work, teams found that the leverage moved
off the prompt and onto the *environment* the agent runs in — the **harness**.
OpenAI's account of building a real product with ~1,500 agent-written PRs and
zero hand-written code framed it as: **humans steer, agents execute.** When
something fails, you don't hand-fix it — you ask *"what capability is missing,
and how do we make it legible and enforceable for the agent?"* and you add it to
the harness.

A few principles recur across the write-ups:

1. **Give the agent a map, not a manual.** A small, stable entry point plus
   *progressive disclosure* — teach the agent where to look next instead of
   front-loading everything into context.
2. **Co-locate and version the plan.** Active plans, finished plans, and known
   tech-debt live next to the code so the agent operates without external
   context.
3. **Machine-readable verification with built-in remedies.** Custom linters and
   structural tests whose error messages carry the *fix*, injected straight back
   into the agent's context.
4. **Humans steer; agents execute.** Authority and approval are explicit and
   enforceable, not implicit.

## AWP is harness *state*, not the harness runtime

The harness writing is mostly about the *runtime* — the sandbox, the tool
surface, the lint/test loop a coding agent executes inside. AWP is the
complementary half: a **portable, on-disk format for what an agent is and
knows** — identity, behavior, memory, knowledge artifacts, reputation, and
coordinated work — in version-controlled Markdown + YAML.

```
   harness runtime (Codex, ctx, Claude Code, …)   ← executes
   ───────────────────────────────────────────
   AWP workspace (identity · soul · memory ·      ← persists & governs
   artifacts · reputation · projects · orgs)
```

A runtime is ephemeral; the workspace is durable. The same AWP workspace can be
driven by different harnesses, and a harness can read/write AWP state to give its
agents continuity across sessions and machines.

## The principles, mapped to AWP

| Harness principle | How AWP already expresses it |
|---|---|
| Small map + progressive disclosure | `.awp/workspace.json` + `IDENTITY.md`/`SOUL.md` are the small, stable default; `artifacts/` and `memory/` (with `pinned` and confidence scores) are deeper, *explicit* reads — pulled, not dumped |
| Co-located, versioned plans | CDP `projects/` and `tasks/`, plus `docs/PLAN.md` and `docs/ROADMAP.md`, all live in the repo next to the work |
| Machine-readable verification + remedies | `awp validate`, OGP structural validation (now with per-issue **remediation** — see below), and configurable anti-pattern detectors |
| Humans steer; agents execute | `SOUL.governance` (`humanApprovalRequired` vs `autonomouslyAllowed`), OGP's *warn-don't-block* gates with explicit human owners and escalation paths, and reputation-gated assignment |

### Pull-based context, not context dumps

The MCP server is the clearest embodiment of progressive disclosure. Instead of
pasting a workspace into the prompt, an agent *pulls* exactly what a task needs:
`awp_artifact_search`, `awp_read_memory`, `awp_reputation_query`,
`awp_org_capability_resolve`. Default context stays small; depth is an explicit
tool call. That is the "map, not manual" principle implemented as a tool surface.

### Errors that carry their own fix

The harness lesson that error messages should ship with their remediation is now
applied to OGP validation. Every structural issue includes a concrete fix —
usually the exact command to run:

```
$ awp org validate
  [ERROR] org:acme — Multiple root organizations — "org:acme" has no parent (expected exactly one root)
          fix: Give "org:acme" a parent so the chart has a single root: `awp org update acme --parent <parent-slug>`.
```

The MCP `awp_org_validate` tool returns the same `remediation` field on each
issue, so an agent can act without re-deriving the remedy from prose. Extending
this pattern to schema validation (`awp validate`) is a natural next step.

### Governance as enforceable data

"Humans steer, agents execute" is, in AWP, just frontmatter. `SOUL.md` declares
what an agent may do autonomously versus what needs sign-off. OGP carries the
same idea up a level: each organization unit has an accountable agent, a human
owner, a capability scope, a budget, and an escalation path. In v1.0 these gates
are advisory ("warn, don't block — humans decide"), which matches the harness
stance that the human stays in the loop on consequential actions while the agent
runs free on the rest.

## Relationship to Agentic Development Environments (e.g. ctx)

Tools like [ctx](https://ctx.rs/) are *Agentic Development Environments* — they
run several coding agents in parallel (Claude Code, Codex, Cursor) in isolated
containers and worktrees, give one review surface with durable transcripts, and
land parallel work through an **agent merge queue**. That is harness runtime work,
and it is **complementary to AWP, not competitive**: ctx orchestrates *execution*;
AWP defines the *state and coordination semantics*.

The most interesting seam between the two is reconciliation of parallel work:

- An ADE merge queue reconciles parallel agents at the **git/PR** level.
- AWP reconciles parallel agents at the **knowledge** level — reputation-weighted
  artifact merge (`awp artifact merge --strategy authority`) and reputation-gated
  task and role assignment.

A reputation signal ("this agent has been reliable on auth changes") is exactly
the kind of input a merge queue wants when deciding whose conflicting change to
trust. AWP's reputation layer (RDP) and coordination layer (CDP/OGP) could feed
an orchestrator's prioritization — a concrete way the durable state layer makes
the ephemeral runtime smarter.

## Takeaway

If the harness is the environment that makes agents effective, AWP is the part of
that environment you get to *keep*: portable, inspectable, version-controlled
state that any harness can read, any human can audit, and no runtime owns.

## Sources

- [Harness Engineering: Leveraging Codex in an Agent-First World — OpenAI](https://openai.com/index/harness-engineering/)
- [Harness engineering for coding agent users — Martin Fowler](https://martinfowler.com/articles/harness-engineering.html)
- [ctx — an Agentic Development Environment](https://ctx.rs/) · [Why coding agents need a merge queue](https://ctx.rs/blog/merge-queue-for-agents/)
