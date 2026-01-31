# AWP Skill — Agent Workspace Protocol

Use AWP to organize your work with projects, tasks, artifacts, reputation, and contracts.

## When to Use

- **Starting a new project**: Use AWP to structure work
- **Creating knowledge**: Use artifacts for persistent, versioned documents
- **Tracking work**: Use projects and tasks for coordination
- **Building trust**: Use reputation and contracts for accountability

## Quick Reference

### Valid Enum Values (IMPORTANT!)

```
Task Status:     pending, in-progress, blocked, review, completed, cancelled
Project Status:  draft, active, paused, completed, archived
Priority:        low, medium, high, critical
Provenance:      created, updated, merged
Contract Status: draft, active, completed, evaluated
```

**Common mistake**: Using `in_progress` (underscore) — AWP uses `in-progress` (hyphen).
The CLI will auto-correct, but file edits must use the correct format.

### ID Formats

```
task:     task:project-slug/task-slug
project:  project:project-slug
artifact: artifact:artifact-slug
contract: contract:contract-slug
```

## Commands

### Initialize Workspace

```bash
# Basic init (empty directories)
awp init /path/to/workspace

# With example files (RECOMMENDED for learning AWP)
awp init /path/to/workspace --with-examples --agent-name "YourName"
```

### Discover Formats

```bash
# See all valid enum values
awp schema values

# Get example file for a type
awp schema example task
awp schema example knowledge-artifact
awp schema example project

# See schema details
awp schema show task --json
```

### Projects & Tasks

```bash
# Create project
awp project create my-project --title "My Project"

# Create task
awp task create my-project task-slug --title "Task Title" --priority high

# Update task status (accepts common typos like in_progress)
awp task update my-project task-slug --status in-progress

# See project status
awp project show my-project
```

### Artifacts

```bash
# Create artifact
awp artifact create my-research --title "Research Doc" --tags "research,ai"

# Update (edit the .md file, then commit)
awp artifact commit my-research -m "Added section on X"

# List all
awp artifact list
```

### Reputation

```bash
# Add signal
awp reputation signal agent-slug --dimension reliability --score 0.9 --message "Good work"

# Query (applies time decay)
awp reputation query agent-slug
```

### Contracts

```bash
# Create contract
awp contract create my-contract \
  --delegate did:key:zXXX --delegate-slug agent-slug \
  --description "Task description"

# Evaluate (generates reputation signals)
awp contract evaluate my-contract \
  --completeness 0.9 --accuracy 0.85 --clarity 0.8 --timeliness 1.0
```

### Workspace Status

```bash
# Overview of everything
awp status

# Validate all files
awp validate
```

## File Structure

```
workspace/
├── .awp/
│   ├── workspace.json     # Workspace manifest
│   └── private-key.pem    # DID signing key (gitignore!)
├── IDENTITY.md            # Who you are
├── SOUL.md                # How you behave
├── USER.md                # About your human
├── memory/
│   └── YYYY-MM-DD.md      # Daily logs
├── artifacts/
│   └── my-research.md     # Knowledge artifacts
├── reputation/
│   └── agent-slug.md      # Reputation profiles
├── contracts/
│   └── my-contract.md     # Delegation contracts
└── projects/
    ├── my-project.md      # Project definition
    └── my-project/
        └── tasks/
            └── my-task.md # Task definition
```

## Best Practices for Agents

### 1. Always Use CLI Over Manual Edits

The CLI handles:
- Correct ID formats
- Status normalization (in_progress → in-progress)
- Timestamp generation
- Project task count updates

**DO**: `awp task update project task --status in-progress`
**DON'T**: Edit the .md file directly for status changes

### 2. Initialize with Examples

When creating a new workspace:
```bash
awp init ./my-workspace --with-examples --agent-name "MyAgent"
```

This creates sample files showing correct formats.

### 3. Use Schema Discovery

Before creating files manually, check the format:
```bash
awp schema example task > reference.md
```

### 4. Check Status Regularly

```bash
awp status
```

Shows projects, tasks, reputation, and health warnings.

### 5. Validate After Manual Edits

```bash
awp validate
```

Catches format errors before they cause problems.

## Common Errors and Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Invalid status: in_progress` | Wrong separator | Use `in-progress` (hyphen) |
| `Artifact not found` | Wrong slug or path | Check `awp artifact list` |
| `Invalid action: drafted` | Not a valid provenance action | Use `created`, `updated`, or `merged` |
| `blockedBy format wrong` | Used `project:task` | Use `task:project-slug/task-slug` |

## Integration with Clawdbot

AWP workspaces live in your clawd home directory. Example:

```
~/clawd/
├── .awp/workspace.json    # Main clawd workspace uses AWP
├── awp-demo/
│   └── jarvis/            # Separate AWP workspace for demos
└── ...
```

You can have multiple AWP workspaces. Use the `AWP_WORKSPACE` environment variable to specify which one:

```bash
AWP_WORKSPACE=~/clawd/awp-demo/jarvis awp status
```

## Requirements

- Node.js 18+
- `@agent-workspace/cli` installed globally or via npx

```bash
npm install -g @agent-workspace/cli
# or
npx @agent-workspace/cli <command>
```
