/**
 * awp schema — Agent-friendly schema discovery
 *
 * Allows agents to discover AWP file formats without reading docs.
 * This makes AWP more "plug and play" for AI agents.
 */

import { readFile } from "node:fs/promises";
import { SCHEMA_MAP, getSchemaPath } from "@agent-workspace/core";
import {
  VALID_TASK_STATUSES,
  VALID_PROJECT_STATUSES,
  VALID_PROVENANCE_ACTIONS,
  VALID_PRIORITIES,
} from "@agent-workspace/utils";

/** Schema types that agents can query */
const SCHEMA_TYPES = [
  "identity",
  "soul",
  "user",
  "operations",
  "tools",
  "knowledge-artifact",
  "reputation-profile",
  "delegation-contract",
  "project",
  "task",
  "swarm",
  "experiment",
  "manifesto",
] as const;

type SchemaType = (typeof SCHEMA_TYPES)[number];

/**
 * awp schema list — List all available schema types
 */
export async function schemaListCommand(): Promise<void> {
  console.log("Available AWP schema types:\n");
  for (const type of SCHEMA_TYPES) {
    const schemaFile = SCHEMA_MAP[type];
    console.log(`  ${type.padEnd(22)} → ${schemaFile || "(no schema)"}`);
  }
  console.log("\nUse 'awp schema show <type>' to see the full schema.");
  console.log("Use 'awp schema values' to see valid enum values.");
}

/**
 * awp schema show <type> — Show schema for a specific type
 */
export async function schemaShowCommand(type: string, options: { json?: boolean }): Promise<void> {
  if (!SCHEMA_TYPES.includes(type as SchemaType)) {
    console.error(`Unknown type: "${type}"`);
    console.error(`Valid types: ${SCHEMA_TYPES.join(", ")}`);
    process.exit(1);
  }

  const schemaFile = SCHEMA_MAP[type];
  if (!schemaFile) {
    console.error(`No schema defined for type: ${type}`);
    process.exit(1);
  }

  try {
    const schemaPath = getSchemaPath(schemaFile);
    const content = await readFile(schemaPath, "utf-8");
    const schema = JSON.parse(content);

    if (options.json) {
      console.log(JSON.stringify(schema, null, 2));
    } else {
      console.log(`Schema for "${type}":\n`);
      console.log(`File: ${schemaFile}`);
      console.log(`Required fields: ${(schema.required || []).join(", ") || "(none)"}\n`);
      console.log("Properties:");
      const props = schema.properties || {};
      for (const [key, value] of Object.entries(props)) {
        const v = value as Record<string, unknown>;
        const typeStr = v.enum ? `enum: [${(v.enum as string[]).join(", ")}]` : v.type || "any";
        const desc = v.description ? ` — ${v.description}` : "";
        console.log(`  ${key}: ${typeStr}${desc}`);
      }
    }
  } catch (err) {
    console.error(`Error loading schema: ${err}`);
    process.exit(1);
  }
}

/**
 * awp schema values — Show all valid enum values (most useful for agents)
 */
export async function schemaValuesCommand(options: { json?: boolean }): Promise<void> {
  const values = {
    taskStatus: [...VALID_TASK_STATUSES],
    projectStatus: [...VALID_PROJECT_STATUSES],
    provenanceAction: [...VALID_PROVENANCE_ACTIONS],
    priority: [...VALID_PRIORITIES],
    // Add more as needed
    artifactType: ["knowledge-artifact"],
    contractStatus: ["draft", "active", "completed", "evaluated"],
    swarmStatus: ["recruiting", "active", "paused", "completed", "disbanded"],
  };

  if (options.json) {
    console.log(JSON.stringify(values, null, 2));
    return;
  }

  console.log("Valid AWP enum values:\n");
  console.log("Task Status:");
  console.log(`  ${VALID_TASK_STATUSES.join(", ")}\n`);

  console.log("Project Status:");
  console.log(`  ${VALID_PROJECT_STATUSES.join(", ")}\n`);

  console.log("Provenance Action:");
  console.log(`  ${VALID_PROVENANCE_ACTIONS.join(", ")}\n`);

  console.log("Priority:");
  console.log(`  ${VALID_PRIORITIES.join(", ")}\n`);

  console.log("Contract Status:");
  console.log(`  draft, active, completed, evaluated\n`);

  console.log("Swarm Status:");
  console.log(`  recruiting, active, paused, completed, disbanded\n`);

  console.log("---");
  console.log("Tip: Use 'awp schema values --json' for machine-readable output.");
}

/**
 * awp schema example <type> — Show an example file for a type
 */
export async function schemaExampleCommand(type: string): Promise<void> {
  const examples: Record<string, string> = {
    task: `---
awp: "0.4.0"
cdp: "1.0"
type: "task"
id: "task:my-project/my-task"
projectId: "project:my-project"
title: "My Task Title"
status: "pending"          # Valid: pending, in-progress, blocked, review, completed, cancelled
priority: "medium"         # Valid: low, medium, high, critical
created: "2026-01-31T12:00:00.000Z"
blockedBy: []              # Array of task IDs like "task:project/slug"
blocks: []
# Optional fields:
# assignee: "did:key:zXXX"
# assigneeSlug: "agent-slug"
# deadline: "2026-02-15T00:00:00.000Z"
# outputArtifact: "artifact-slug"
# contractSlug: "contract-slug"
---

# My Task Title

## Acceptance Criteria

- Criterion 1
- Criterion 2

## Notes

- Notes go here
`,
    "knowledge-artifact": `---
awp: "0.4.0"
smp: "1.0"
type: "knowledge-artifact"
id: "artifact:my-artifact"
title: "My Artifact Title"
authors:
  - "did:key:zXXX"
version: 1
confidence: 0.8            # 0.0 to 1.0
tags:
  - "tag1"
  - "tag2"
created: "2026-01-31T12:00:00.000Z"
lastModified: "2026-01-31T12:00:00.000Z"
modifiedBy: "did:key:zXXX"
provenance:
  - agent: "did:key:zXXX"
    action: "created"      # Valid: created, updated, merged
    timestamp: "2026-01-31T12:00:00.000Z"
    message: "Initial creation"
---

# My Artifact Title

Content goes here...
`,
    project: `---
awp: "0.4.0"
cdp: "1.0"
type: "project"
id: "project:my-project"
title: "My Project Title"
status: "active"           # Valid: draft, active, paused, completed, archived
owner: "did:key:zXXX"
created: "2026-01-31T12:00:00.000Z"
members:
  - did: "did:key:zXXX"
    role: "lead"
    slug: "agent-slug"
tags:
  - "tag1"
taskCount: 0
completedCount: 0
---

# My Project Title

## Goals

- Goal 1
- Goal 2

## Notes

- Notes go here
`,
    "reputation-profile": `---
awp: "0.4.0"
rdp: "1.0"
type: "reputation-profile"
id: "reputation:agent-slug"
agentDid: "did:key:zXXX"
agentName: "Agent Name"
lastUpdated: "2026-01-31T12:00:00.000Z"
dimensions:
  reliability:
    score: 0.85            # 0.0 to 1.0
    confidence: 0.50       # Based on sample size
    sampleSize: 10
    lastSignal: "2026-01-31T12:00:00.000Z"
  epistemic-hygiene:
    score: 0.80
    confidence: 0.33
    sampleSize: 5
    lastSignal: "2026-01-31T12:00:00.000Z"
  coordination:
    score: 0.75
    confidence: 0.25
    sampleSize: 3
    lastSignal: "2026-01-31T12:00:00.000Z"
domainCompetence:
  my-domain:
    score: 0.90
    confidence: 0.50
    sampleSize: 10
    lastSignal: "2026-01-31T12:00:00.000Z"
signals:
  - source: "did:key:zEvaluator"
    dimension: "reliability"
    score: 0.85
    timestamp: "2026-01-31T12:00:00.000Z"
    evidence: "contract:my-contract"
    message: "Completed task successfully"
---

# Agent Name — Reputation Profile

Notes about this agent's reputation...
`,
  };

  if (!examples[type]) {
    console.error(`No example available for type: "${type}"`);
    console.error(`Available examples: ${Object.keys(examples).join(", ")}`);
    process.exit(1);
  }

  console.log(examples[type]);
}
