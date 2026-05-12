---
awp: 0.4.0
smp: '1.0'
type: knowledge-artifact
id: 'artifact:mcp-coverage-report'
title: AWP MCP Coverage Sweep — Final Report
authors:
  - 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
version: 1
confidence: 0.9
tags:
  - mcp
  - report
  - qa
  - dogfood
created: '2026-05-12T17:00:11.060Z'
lastModified: '2026-05-12T17:00:11.060Z'
modifiedBy: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
provenance:
  - agent: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
    action: created
    timestamp: '2026-05-12T17:00:11.060Z'
    message: 'Final coverage-sweep report — all categories exercised, 3 issues filed'
---

## Scope

End-to-end exercise of every category of the AWP MCP server against the live
repo workspace (`/Users/marcsperzel/code/ai-ml/awp`), bootstrapped at the root
via `awp init` and a freshly-minted Ed25519 DID.

## Tools exercised — all passed

| Category | Tools | Notes |
|---|---|---|
| Workspace inspection | `awp_workspace_status` | pre-init vs post-init both correct |
| Identity reads | `awp_read_identity`, `awp_read_soul`, `awp_read_user`, `awp_read_agents`, `awp_read_tools`, `awp_read_heartbeat` | frontmatter + body parsed cleanly |
| Memory | `awp_write_memory`, `awp_read_memory` (date / `recent` / `longterm`) | daily log appends correctly; `longterm` cleanly reports missing MEMORY.md |
| Projects | `awp_project_create`, `awp_project_list`, `awp_project_status` | tag + deadline + slug round-trip |
| Tasks | `awp_task_create` (with `blockedBy`), `awp_task_list`, `awp_task_update`, `awp_task_graph` | topo sort + cycle detection correct |
| Artifacts | `awp_artifact_write` (v1, v2 via merge), `awp_artifact_read`, `awp_artifact_list`, `awp_artifact_search`, `awp_artifact_merge` (additive) | provenance trail preserved; tags unioned |
| Reputation | `awp_reputation_signal` (creates profile), `awp_reputation_query` (single + list) | signals append, decayed score equals raw score on fresh signal |
| Contracts | `awp_contract_create`, `awp_contract_list`, `awp_contract_evaluate` | weighted score 0.868 matches manual calc; reliability signal auto-emitted |
| Swarms | `awp_swarm_create`, `awp_swarm_role_add`, `awp_swarm_recruit` (manual + `auto`), `awp_swarm_assign`, `awp_swarm_show` | rep gates enforced; manual assign bypasses gate |
| Experiments | `awp_experiment_list`, `awp_experiment_compare`, `awp_experiment_metrics` | Welch's t-test, effect sizes, per-cycle stats all returned |
| Sync | `awp_sync_status`, `awp_sync_remote_list`, `awp_sync_conflicts` | empty-state correct (no remotes configured) |

## Confirmed findings

### Issue 1 — `awp init --with-examples` leaves 3 canonical files missing

Newly-initialized workspaces are missing `AGENTS.md`, `TOOLS.md`,
`HEARTBEAT.md` but `awp_workspace_status` still reports `health.ok: true`.
The health check only warns on IDENTITY/SOUL.

**Suggested fix:** either always create minimal stubs for all 7 canonical
files during `init`, or extend the health check to warn on any missing
canonical file.

### Issue 2 — `swarm_recruit` doesn't resolve domain-competence keys

`swarm_role_add { minReputation: { documentation: 0.6 } }` does not match a
candidate's `domainCompetence.documentation.score`. The recruiter returns
`scores: { documentation: 0 }` even when the candidate has a real signal in
that domain.

**Likely cause:** the matcher only looks at `dimensions.*.score`, not
`domainCompetence.*.score`. A bare key like `documentation` should either be
resolved to the domain or require explicit `domain:documentation` syntax.

### Issue 3 — `awp init` doesn't update `.gitignore`

The CLI warns about `private-key.pem` but doesn't auto-add the workspace
files (IDENTITY, SOUL, USER, AGENTS, TOOLS, HEARTBEAT, MEMORY,
.awp/workspace.json) to `.gitignore`. In this repo they're already ignored,
but a fresh `awp init` inside a different repo would leave them tracked by
default.

## Observations

- **Topological order on `task_graph`** is correct; `criticalPath` returns
  only the terminal node. This is consistent with "the task that is on the
  critical path" but ambiguous w.r.t. whether the API surfaces the full path.
  Spec should clarify.
- **`artifact_merge` additive** appends body with a clean separator and
  unions tags. Worked exactly as documented.
- **Experiment compare** is the most impressive surface area — proper Welch's
  t-test with effect sizes and p-values, plus per-metric breakdown. Found a
  significant token-efficiency difference between manifestos in the existing
  societies/ test fixtures (p=0.039).

## Coverage stats

- 35 distinct MCP tool calls
- 0 errors
- 3 issues filed (all in artifact:mcp-coverage-findings@2)
- 1 project, 5 tasks, 3 artifacts, 1 contract, 2 reputation profiles,
  1 swarm with 2 roles created

## Workspace state after sweep

- Health: `ok: true`, all 7 canonical files present
- Daily memory log populated with 2 entries
- artifacts/, projects/, contracts/, reputation/, swarms/ all populated
  with real (not placeholder) test data
- All workspace private files gitignored

