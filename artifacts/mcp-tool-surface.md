---
awp: 0.4.0
smp: '1.0'
type: knowledge-artifact
id: 'artifact:mcp-tool-surface'
title: AWP MCP Tool Surface — Categorized Inventory
authors:
  - 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
version: 1
confidence: 0.9
tags:
  - mcp
  - inventory
  - reference
created: '2026-05-12T16:54:56.314Z'
lastModified: '2026-05-12T16:54:56.314Z'
modifiedBy: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
provenance:
  - agent: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
    action: created
    timestamp: '2026-05-12T16:54:56.314Z'
    message: Initial categorized inventory from MCP coverage sweep
---

## Categories

### Read-only (workspace inspection)
- `awp_workspace_status` — manifest, file presence, counts, health
- `awp_read_identity`, `awp_read_soul`, `awp_read_user`, `awp_read_agents`, `awp_read_tools`, `awp_read_heartbeat`
- `awp_read_memory` (target: date | 'longterm' | 'recent')

### Mutations to local state
- `awp_write_memory` (today's log)
- `awp_artifact_write` (create or version-bump)
- `awp_artifact_merge` (additive | authority)

### Project / task graph
- `awp_project_create`, `awp_project_list`, `awp_project_status`
- `awp_task_create`, `awp_task_list`, `awp_task_update`, `awp_task_graph`

### Coordination / trust
- `awp_contract_create`, `awp_contract_list`, `awp_contract_evaluate`
- `awp_reputation_signal`, `awp_reputation_query`

### Swarms
- `awp_swarm_create`, `awp_swarm_list`, `awp_swarm_show`, `awp_swarm_update`
- `awp_swarm_role_add`, `awp_swarm_recruit`, `awp_swarm_assign`

### Experiments (read existing societies/)
- `awp_experiment_list`, `awp_experiment_show`, `awp_experiment_metrics`, `awp_experiment_compare`

### Sync
- `awp_sync_status`, `awp_sync_diff`, `awp_sync_conflicts`
- `awp_sync_remote_add`, `awp_sync_remote_list`, `awp_sync_remote_remove`
- `awp_sync_push`, `awp_sync_pull`, `awp_sync_push_signals`, `awp_sync_pull_signals`, `awp_sync_resolve`

## Notes
- Identifiers are slugs, not paths. The server resolves `slug → file under <category>/<slug>.md`.
- `awp_artifact_write` is idempotent on slug — second call bumps `version` and appends provenance.
- `awp_contract_evaluate` emits reputation signals as a side effect; no separate call needed.

