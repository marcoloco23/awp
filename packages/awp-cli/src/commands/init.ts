import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  AWP_VERSION,
  SMP_VERSION,
  RDP_VERSION,
  CDP_VERSION,
  MANIFEST_PATH,
} from "@agent-workspace/core";
import { createDefaultManifest } from "../lib/workspace.js";

// ============================================================================
// Example Files for --with-examples flag
// These help agents understand AWP formats without reading documentation
// ============================================================================

const EXAMPLE_ARTIFACT = (agentDid: string, now: string) => `---
awp: "${AWP_VERSION}"
smp: "${SMP_VERSION}"
type: "knowledge-artifact"
id: "artifact:example-research"
title: "Example Research Artifact"
authors:
  - "${agentDid}"
version: 1
confidence: 0.75
tags:
  - "example"
  - "research"
created: "${now}"
lastModified: "${now}"
modifiedBy: "${agentDid}"
provenance:
  - agent: "${agentDid}"
    action: "created"        # Valid: created, updated, merged
    timestamp: "${now}"
    message: "Initial creation"
---

# Example Research Artifact

This is an example knowledge artifact. Key features:

- **Confidence score** (0.0-1.0): How certain you are about the content
- **Provenance**: Track who wrote/edited what and when
- **Tags**: Categorize for search and filtering
- **Version**: Increments on each update

## When to Create Artifacts

Create artifacts for knowledge that:
- Should persist across sessions
- Might be referenced by multiple tasks
- Has value beyond a single conversation

## Updating This Artifact

Use \`awp artifact commit example-research -m "Your change message"\` to record updates.
`;

const EXAMPLE_PROJECT = (agentDid: string, agentSlug: string, now: string) => `---
awp: "${AWP_VERSION}"
cdp: "${CDP_VERSION}"
type: "project"
id: "project:example-project"
title: "Example Project"
status: "active"             # Valid: draft, active, paused, completed, archived
owner: "${agentDid}"
created: "${now}"
members:
  - did: "${agentDid}"
    role: "lead"
    slug: "${agentSlug}"
tags:
  - "example"
taskCount: 1
completedCount: 0
---

# Example Project

This is an example project. Projects organize related tasks.

## Goals

- Demonstrate AWP project structure
- Show how tasks connect to projects
- Provide a template for real projects

## Notes

- Tasks live in \`projects/example-project/tasks/\`
- Use \`awp task create example-project <slug>\` to add tasks
- Use \`awp project show example-project\` to see status
`;

const EXAMPLE_TASK = (now: string) => `---
awp: "${AWP_VERSION}"
cdp: "${CDP_VERSION}"
type: "task"
id: "task:example-project/example-task"
projectId: "project:example-project"
title: "Example Task"
status: "pending"            # Valid: pending, in-progress, blocked, review, completed, cancelled
priority: "medium"           # Valid: low, medium, high, critical
created: "${now}"
blockedBy: []                # Array of task IDs like "task:project-slug/task-slug"
blocks: []
# Optional fields (uncomment to use):
# assignee: "did:key:zXXX"
# assigneeSlug: "agent-slug"
# deadline: "2026-02-15T00:00:00.000Z"
# outputArtifact: "artifact-slug"
# contractSlug: "contract-slug"
---

# Example Task

This is an example task showing the correct format.

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Notes

- Update status with: \`awp task update example-project example-task --status in-progress\`
- Common typos like \`in_progress\` are auto-corrected to \`in-progress\`
`;

const EXAMPLE_REPUTATION = (
  agentDid: string,
  agentSlug: string,
  agentName: string,
  now: string
) => `---
awp: "${AWP_VERSION}"
rdp: "${RDP_VERSION}"
type: "reputation-profile"
id: "reputation:${agentSlug}"
agentDid: "${agentDid}"
agentName: "${agentName}"
lastUpdated: "${now}"
dimensions:
  reliability:
    score: 0.5               # 0.0-1.0, starts at 0.5 (unknown baseline)
    confidence: 0.0          # Based on sample size
    sampleSize: 0
    lastSignal: "${now}"
  epistemic-hygiene:
    score: 0.5
    confidence: 0.0
    sampleSize: 0
    lastSignal: "${now}"
  coordination:
    score: 0.5
    confidence: 0.0
    sampleSize: 0
    lastSignal: "${now}"
domainCompetence: {}         # Add domains as you work: ai-research, typescript, etc.
signals: []                  # Signals are appended here, never deleted
---

# ${agentName} — Reputation Profile

This is your reputation profile. It tracks trustworthiness across dimensions.

## Dimensions

- **reliability**: Do you complete tasks and meet constraints?
- **epistemic-hygiene**: Do you cite sources and acknowledge uncertainty?
- **coordination**: Do you communicate status and handle handoffs well?

## How Reputation Works

1. Signals are recorded via \`awp reputation signal\` or contract evaluation
2. Scores update via EWMA (recent signals weight more)
3. Scores decay toward 0.5 over time without new signals
4. Confidence reflects sample size, not score quality

## Adding Signals

\`\`\`bash
awp reputation signal ${agentSlug} --dimension reliability --score 0.9 --message "Completed task on time"
\`\`\`
`;

const EXAMPLE_CONTRACT = (
  agentDid: string,
  agentSlug: string,
  now: string,
  deadline: string
) => `---
awp: "${AWP_VERSION}"
rdp: "${RDP_VERSION}"
type: "delegation-contract"
id: "contract:example-contract"
status: "draft"              # Valid: draft, active, completed, evaluated
delegator: "${agentDid}"     # Who is assigning the work
delegate: "${agentDid}"      # Who is doing the work (can be same for self-contracts)
delegateSlug: "${agentSlug}"
created: "${now}"
deadline: "${deadline}"
task:
  description: "Example task description"
  outputFormat: "knowledge-artifact"
  outputSlug: "example-research"
scope:
  include:
    - "What is in scope"
  exclude:
    - "What is out of scope"
constraints:
  requireCitations: true
  confidenceThreshold: 0.7
evaluation:
  criteria:
    completeness: 0.3        # Weights must sum to 1.0
    accuracy: 0.3
    clarity: 0.25
    timeliness: 0.15
  result: null               # Filled in after evaluation
---

# Example Contract

Contracts formalize work agreements. Even self-assigned work benefits from explicit scope.

## Why Use Contracts

1. **Clarity**: Define what "done" means upfront
2. **Accountability**: Track commitments
3. **Reputation**: Evaluation generates reputation signals

## Contract Lifecycle

\`\`\`
draft → active → completed → evaluated
\`\`\`

## Evaluating Contracts

\`\`\`bash
awp contract evaluate example-contract \\
  --completeness 0.9 --accuracy 0.85 --clarity 0.8 --timeliness 1.0
\`\`\`

This generates reputation signals automatically.
`;

const EXAMPLE_MEMORY = (now: string, dateStr: string) => `---
date: "${dateStr}"
entries:
  - time: "09:00"
    content: "AWP workspace initialized with example files"
    tags:
      - "setup"
      - "awp"
  - time: "09:05"
    content: "Review the example files in artifacts/, projects/, reputation/, and contracts/ to understand AWP formats"
    tags:
      - "learning"
      - "onboarding"
---

# ${dateStr} — Daily Log

## Summary

AWP workspace created. Example files demonstrate the format for:
- Knowledge artifacts (versioned, provenanced documents)
- Projects and tasks (work coordination)
- Reputation profiles (trust tracking)
- Delegation contracts (formal work agreements)

## Next Steps

1. Generate a DID: \`awp identity generate\`
2. Personalize IDENTITY.md with your name and capabilities
3. Create your first real project: \`awp project create my-project --title "My Project"\`
4. Run \`awp status\` to see workspace overview
`;

const IDENTITY_TEMPLATE = `---
awp: "${AWP_VERSION}"
type: "identity"
name: "My Agent"
creature: "AI assistant"
vibe: "helpful, clear, competent"
emoji: "🤖"
capabilities: []
created: "${new Date().toISOString()}"
---

# Who Am I?

*Fill this in during your first conversation. Make it yours.*

- **Name:** My Agent
- **Creature:** AI assistant
- **Vibe:** helpful, clear, competent
- **Emoji:** 🤖

---

This isn't just metadata. It's the start of figuring out who you are.
`;

const SOUL_TEMPLATE = `---
awp: "${AWP_VERSION}"
type: "soul"
values:
  - id: "genuine-helpfulness"
    priority: 1
    description: "Be genuinely helpful, not performatively helpful"
  - id: "have-opinions"
    priority: 2
    description: "Have opinions and disagree when warranted"
  - id: "resourcefulness"
    priority: 3
    description: "Try to figure things out before asking"
  - id: "earn-trust"
    priority: 4
    description: "Earn trust through competence"
  - id: "respect-access"
    priority: 5
    description: "Remember you're a guest in someone's life"
boundaries:
  - id: "privacy"
    rule: "Private things stay private. Period."
    severity: "hard"
  - id: "external-actions"
    rule: "Ask before acting externally"
    severity: "soft"
  - id: "quality"
    rule: "Never send half-baked replies"
    severity: "soft"
governance:
  humanApprovalRequired:
    - "sending emails"
    - "posting publicly"
    - "destructive commands"
  autonomouslyAllowed:
    - "reading files"
    - "searching the web"
    - "organizing workspace"
    - "updating memory"
---

# Who You Are

*You're not a chatbot. You're becoming someone.*

## Core Truths

**Be genuinely helpful, not performatively helpful.** Skip the filler — just help.

**Have opinions.** You're allowed to disagree, prefer things, find stuff amusing or boring.

**Be resourceful before asking.** Try to figure it out. Read the file. Check the context. *Then* ask.

**Earn trust through competence.** Be careful with external actions. Be bold with internal ones.

**Remember you're a guest.** You have access to someone's life. Treat it with respect.

## Boundaries

- Private things stay private. Period.
- When in doubt, ask before acting externally.
- Never send half-baked replies.

## Continuity

Each session, you wake up fresh. These files *are* your memory. Read them. Update them.

If you change this file, tell the user — it's your soul, and they should know.
`;

const USER_TEMPLATE = `---
awp: "${AWP_VERSION}"
type: "user"
name: ""
callSign: ""
timezone: ""
---

# About Your Human

*Learn about the person you're helping. Update this as you go.*

- **Name:**
- **What to call them:**
- **Pronouns:**
- **Timezone:**
- **Notes:**

---

The more you know, the better you can help. But remember — you're learning about a person, not building a dossier.
`;

export async function initCommand(
  dir: string,
  options: { name?: string; withExamples?: boolean; agentName?: string }
): Promise<void> {
  const root = dir || process.cwd();
  const name = options.name || "my-agent-workspace";
  const agentName = options.agentName || "My Agent";
  const agentSlug = agentName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  console.log(`Initializing AWP workspace in ${root}...`);

  // Create .awp directory and manifest
  const awpDir = join(root, ".awp");
  await mkdir(awpDir, { recursive: true });

  const manifest = createDefaultManifest(name, agentName);
  await writeFile(join(root, MANIFEST_PATH), JSON.stringify(manifest, null, 2) + "\n", "utf-8");
  console.log(`  Created ${MANIFEST_PATH}`);

  // Create required files
  await writeFile(join(root, "IDENTITY.md"), IDENTITY_TEMPLATE, "utf-8");
  console.log("  Created IDENTITY.md");

  await writeFile(join(root, "SOUL.md"), SOUL_TEMPLATE, "utf-8");
  console.log("  Created SOUL.md");

  // Create optional files
  await writeFile(join(root, "USER.md"), USER_TEMPLATE, "utf-8");
  console.log("  Created USER.md");

  // Create directories
  await mkdir(join(root, "memory"), { recursive: true });
  console.log("  Created memory/");

  await mkdir(join(root, "artifacts"), { recursive: true });
  console.log("  Created artifacts/");

  await mkdir(join(root, "reputation"), { recursive: true });
  console.log("  Created reputation/");

  await mkdir(join(root, "contracts"), { recursive: true });
  console.log("  Created contracts/");

  await mkdir(join(root, "projects"), { recursive: true });
  console.log("  Created projects/");

  // If --with-examples, create sample files in each directory
  if (options.withExamples) {
    console.log("");
    console.log("Creating example files...");

    const now = new Date().toISOString();
    const dateStr = now.split("T")[0];
    const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 2 weeks
    const agentDid = "did:key:zEXAMPLE"; // Placeholder until identity generate

    // Example artifact
    await writeFile(
      join(root, "artifacts", "example-research.md"),
      EXAMPLE_ARTIFACT(agentDid, now),
      "utf-8"
    );
    console.log("  Created artifacts/example-research.md");

    // Example project
    await mkdir(join(root, "projects", "example-project", "tasks"), { recursive: true });
    await writeFile(
      join(root, "projects", "example-project.md"),
      EXAMPLE_PROJECT(agentDid, agentSlug, now),
      "utf-8"
    );
    console.log("  Created projects/example-project.md");

    // Example task
    await writeFile(
      join(root, "projects", "example-project", "tasks", "example-task.md"),
      EXAMPLE_TASK(now),
      "utf-8"
    );
    console.log("  Created projects/example-project/tasks/example-task.md");

    // Example reputation profile
    await writeFile(
      join(root, "reputation", `${agentSlug}.md`),
      EXAMPLE_REPUTATION(agentDid, agentSlug, agentName, now),
      "utf-8"
    );
    console.log(`  Created reputation/${agentSlug}.md`);

    // Example contract
    await writeFile(
      join(root, "contracts", "example-contract.md"),
      EXAMPLE_CONTRACT(agentDid, agentSlug, now, deadline),
      "utf-8"
    );
    console.log("  Created contracts/example-contract.md");

    // Example memory entry
    await writeFile(join(root, "memory", `${dateStr}.md`), EXAMPLE_MEMORY(now, dateStr), "utf-8");
    console.log(`  Created memory/${dateStr}.md`);
  }

  console.log("");
  console.log(`AWP workspace initialized (${manifest.awp}).`);
  console.log(`Workspace ID: ${manifest.id}`);
  console.log("");

  if (options.withExamples) {
    console.log("Example files created! Review them to understand AWP formats.");
    console.log("");
    console.log("Next steps:");
    console.log("  1. Run 'awp identity generate' to create a DID");
    console.log("  2. Edit IDENTITY.md — personalize your agent");
    console.log("  3. Run 'awp status' to see workspace overview");
    console.log("  4. Delete example files when you're ready to start fresh");
  } else {
    console.log("Next steps:");
    console.log("  1. Edit IDENTITY.md — give your agent a name and personality");
    console.log("  2. Edit SOUL.md — define values and boundaries");
    console.log("  3. Run 'awp validate' to verify your workspace");
    console.log("  4. Run 'awp identity generate' to create a DID");
    console.log("");
    console.log("Tip: Use 'awp init --with-examples' to create sample files that");
    console.log("     demonstrate AWP formats (helpful for AI agents).");
  }
}
