---
awp: 0.4.0
smp: '1.0'
type: knowledge-artifact
id: 'artifact:workspace-init-gaps'
title: Gaps in `awp init` Bootstrap
authors:
  - 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
version: 1
confidence: 0.8
tags:
  - mcp
  - findings
  - init-cli
created: '2026-05-12T16:55:01.707Z'
lastModified: '2026-05-12T16:55:01.707Z'
modifiedBy: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
provenance:
  - agent: 'did:key:z6Mkq5UdbbWW6NGyzJmEZiUNBkz3NWbi3dFuSMqmjsKntg9c'
    action: created
    timestamp: '2026-05-12T16:55:01.707Z'
    message: Gaps observed during dogfood bootstrap
---

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

