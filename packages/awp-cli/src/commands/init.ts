import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AWP_VERSION, MANIFEST_PATH } from "@agent-workspace/core";
import { createDefaultManifest } from "../lib/workspace.js";

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
  options: { name?: string }
): Promise<void> {
  const root = dir || process.cwd();
  const name = options.name || "my-agent-workspace";

  console.log(`Initializing AWP workspace in ${root}...`);

  // Create .awp directory and manifest
  const awpDir = join(root, ".awp");
  await mkdir(awpDir, { recursive: true });

  const manifest = createDefaultManifest(name, "My Agent");
  await writeFile(
    join(root, MANIFEST_PATH),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8"
  );
  console.log(`  Created ${MANIFEST_PATH}`);

  // Create required files
  await writeFile(join(root, "IDENTITY.md"), IDENTITY_TEMPLATE, "utf-8");
  console.log("  Created IDENTITY.md");

  await writeFile(join(root, "SOUL.md"), SOUL_TEMPLATE, "utf-8");
  console.log("  Created SOUL.md");

  // Create optional files
  await writeFile(join(root, "USER.md"), USER_TEMPLATE, "utf-8");
  console.log("  Created USER.md");

  // Create memory and artifacts directories
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

  console.log("");
  console.log(`AWP workspace initialized (${manifest.awp}).`);
  console.log(`Workspace ID: ${manifest.id}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Edit IDENTITY.md — give your agent a name and personality");
  console.log("  2. Edit SOUL.md — define values and boundaries");
  console.log("  3. Run 'awp validate' to verify your workspace");
  console.log("  4. Run 'awp identity generate' to create a DID");
}
