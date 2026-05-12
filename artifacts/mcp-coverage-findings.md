---
awp: 0.4.0
smp: '1.0'
type: knowledge-artifact
id: 'artifact:mcp-coverage-findings'
title: MCP Coverage Sweep — Findings
authors:
  - 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
version: 2
confidence: 0.7
tags:
  - mcp
  - findings
  - qa
  - init-cli
created: '2026-05-12T16:54:56.947Z'
lastModified: '2026-05-12T16:55:12.180Z'
modifiedBy: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
provenance:
  - agent: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
    action: created
    timestamp: '2026-05-12T16:54:56.947Z'
    message: First-pass findings from MCP exercise
  - agent: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
    action: merged
    timestamp: '2026-05-12T16:55:12.180Z'
    message: Fold init gaps into the consolidated findings artifact
    confidence: 0.7
---

## Round 1 observations

- `awp_workspace_status` correctly distinguishes pre-init (`manifest: null`,
  `error: "No .awp/workspace.json found"`) from initialized. Health flips
  from `ok: false` (missing IDENTITY/SOUL) to `ok: true` after `awp init` +
  file writes.
- `awp init --with-examples` creates `example-*` files but does NOT create
  `AGENTS.md`, `TOOLS.md`, `HEARTBEAT.md`. The workspace passes health checks
  anyway because health only warns on IDENTITY/SOUL.
- `awp_task_graph.criticalPath` returns only the terminal node, not the full
  path. Verify whether this is "the critical task" or "the full longest path"
  in the spec.
- `awp_task_graph.blocked` is empty when no tasks are stuck on missing deps,
  even though four of five tasks have `blockedBy` set — i.e. `blocked` means
  "currently blocked by an unresolved dep", not "has any dep".

## Open questions

- Does `awp_artifact_merge` with `strategy: authority` require both source and
  target to have provenance signers tracked in reputation? Need to test.
- `awp_contract_evaluate` returns reputation deltas — confirm they're appended
  to existing `reputation/<slug>.md` rather than overwriting.


---
*Merged from artifact:workspace-init-gaps (version 1) on 2026-05-12T16:55:12.180Z*

## What's missing from `awp init [--with-examples]`

1. **No AGENTS.md / TOOLS.md / HEARTBEAT.md scaffolds.** Templates exist in
   `templates/clawd/` but aren't copied. New workspaces look "healthy"
   (`health.ok: true`) while missing three of the seven canonical files.

2. **No `.gitignore` augmentation.** Newly-init'd workspaces in an existing
   repo don't get their private files protected unless the user has already
   added them. The CLI does print a warning for `private-key.pem` but not for
   IDENTITY/SOUL/USER/MEMORY.

3. **Example files are siblings of real files.** `projects/example-project/`
   and `projects/example-project.md` coexist with real project markdown after
   first real `project create`. A `--with-examples` flag could namespace them
   under `examples/` or be gated behind explicit user opt-in.

## Suggested fixes

- Always create AGENTS.md / TOOLS.md / HEARTBEAT.md, even minimal stubs
- Detect `.gitignore` and append a managed block: `# AWP private workspace`
- Put example content under `artifacts/examples/`, `projects/examples/`, etc.
