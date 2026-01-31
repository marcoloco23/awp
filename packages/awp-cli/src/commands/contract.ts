import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AWP_VERSION, RDP_VERSION, CONTRACTS_DIR } from "@agent-workspace/core";
import type { DelegationContractFrontmatter } from "@agent-workspace/core";
import { findWorkspaceRoot } from "../lib/workspace.js";
import { serializeWorkspaceFile } from "../lib/frontmatter.js";
import {
  validateSlug,
  slugToContractPath,
  loadContract,
  listContracts,
  evaluateContract,
} from "../lib/contract.js";
import { getAgentDid } from "../lib/artifact.js";
import { loadProfile, updateDimension } from "../lib/reputation.js";

/**
 * awp contract create <slug>
 */
export async function contractCreateCommand(
  slug: string,
  options: {
    delegate: string;
    delegateSlug: string;
    description: string;
    delegator?: string;
    deadline?: string;
    outputFormat?: string;
    outputSlug?: string;
  }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  if (!validateSlug(slug)) {
    console.error(`Invalid slug: ${slug} (must be lowercase alphanumeric + hyphens)`);
    process.exit(1);
  }

  const delegatorDid = options.delegator || (await getAgentDid(root));
  const now = new Date().toISOString();

  const fm: DelegationContractFrontmatter = {
    awp: AWP_VERSION,
    rdp: RDP_VERSION,
    type: "delegation-contract",
    id: `contract:${slug}`,
    status: "active",
    delegator: delegatorDid,
    delegate: options.delegate,
    delegateSlug: options.delegateSlug,
    created: now,
    task: {
      description: options.description,
    },
    evaluation: {
      criteria: {
        completeness: 0.3,
        accuracy: 0.4,
        clarity: 0.2,
        timeliness: 0.1,
      },
      result: null,
    },
  };

  if (options.deadline) fm.deadline = options.deadline;
  if (options.outputFormat) fm.task.outputFormat = options.outputFormat;
  if (options.outputSlug) fm.task.outputSlug = options.outputSlug;

  const body =
    `# ${slug} — Delegation Contract\n\n` +
    `Delegated to ${options.delegateSlug}: ${options.description}\n\n` +
    `## Status\nActive — awaiting completion.`;

  await mkdir(join(root, CONTRACTS_DIR), { recursive: true });
  const filePath = slugToContractPath(root, slug);
  const content = serializeWorkspaceFile({
    frontmatter: fm,
    body,
    filePath,
  });
  await writeFile(filePath, content, "utf-8");
  console.log(`Created contracts/${slug}.md (status: active)`);
}

/**
 * awp contract list
 */
export async function contractListCommand(options: { status?: string }): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  let contracts = await listContracts(root);

  if (options.status) {
    contracts = contracts.filter((c) => c.frontmatter.status === options.status);
  }

  if (contracts.length === 0) {
    console.log(
      options.status ? `No contracts with status: ${options.status}` : "No contracts found."
    );
    return;
  }

  const header = "SLUG                 DELEGATE             STATUS      CREATED";
  console.log(header);
  console.log("-".repeat(header.length));

  for (const c of contracts) {
    const fm = c.frontmatter;
    const slug = fm.id.replace("contract:", "");
    const date = fm.created.split("T")[0];
    console.log(`${slug.padEnd(20)} ${fm.delegateSlug.padEnd(20)} ${fm.status.padEnd(11)} ${date}`);
  }
}

/**
 * awp contract show <slug>
 */
export async function contractShowCommand(slug: string): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  let contract;
  try {
    contract = await loadContract(root, slug);
  } catch {
    console.error(`Contract not found: ${slug}`);
    process.exit(1);
  }

  const fm = contract.frontmatter;

  console.log(`Contract: ${fm.id}`);
  console.log(`Status:   ${fm.status}`);
  console.log(`Created:  ${fm.created}`);
  if (fm.deadline) console.log(`Deadline: ${fm.deadline}`);
  console.log("");
  console.log(`Delegator: ${fm.delegator}`);
  console.log(`Delegate:  ${fm.delegate} (${fm.delegateSlug})`);
  console.log("");
  console.log("Task");
  console.log("----");
  console.log(`  ${fm.task.description}`);
  if (fm.task.outputFormat) console.log(`  Output: ${fm.task.outputFormat}`);
  if (fm.task.outputSlug) console.log(`  Artifact: ${fm.task.outputSlug}`);

  if (fm.scope) {
    console.log("");
    console.log("Scope");
    console.log("-----");
    if (fm.scope.include?.length) {
      console.log("  Include:");
      fm.scope.include.forEach((s) => console.log(`    - ${s}`));
    }
    if (fm.scope.exclude?.length) {
      console.log("  Exclude:");
      fm.scope.exclude.forEach((s) => console.log(`    - ${s}`));
    }
  }

  console.log("");
  console.log("Evaluation Criteria");
  console.log("-------------------");
  for (const [name, weight] of Object.entries(fm.evaluation.criteria)) {
    const result = fm.evaluation.result?.[name];
    const resultStr = result !== undefined ? ` → ${result.toFixed(2)}` : "";
    console.log(`  ${name}: ${(weight * 100).toFixed(0)}%${resultStr}`);
  }

  if (fm.evaluation.result) {
    let weighted = 0;
    for (const [name, weight] of Object.entries(fm.evaluation.criteria)) {
      weighted += weight * (fm.evaluation.result[name] || 0);
    }
    console.log("");
    console.log(`Weighted Score: ${weighted.toFixed(3)}`);
  }
}

/**
 * awp contract evaluate <slug>
 */
export async function contractEvaluateCommand(
  slug: string,
  options: {
    completeness?: string;
    accuracy?: string;
    clarity?: string;
    timeliness?: string;
  }
): Promise<void> {
  const root = await findWorkspaceRoot();
  if (!root) {
    console.error("Not in an AWP workspace.");
    process.exit(1);
  }

  let contract;
  try {
    contract = await loadContract(root, slug);
  } catch {
    console.error(`Contract not found: ${slug}`);
    process.exit(1);
  }

  const fm = contract.frontmatter;

  if (fm.status === "evaluated") {
    console.error("Contract has already been evaluated.");
    process.exit(1);
  }

  // Build scores from options and criteria
  const scores: Record<string, number> = {};
  const criteriaNames = Object.keys(fm.evaluation.criteria);

  // Map known CLI options
  const optionMap: Record<string, string | undefined> = {
    completeness: options.completeness,
    accuracy: options.accuracy,
    clarity: options.clarity,
    timeliness: options.timeliness,
  };

  for (const name of criteriaNames) {
    const val = optionMap[name];
    if (val === undefined) {
      console.error(`Missing score for criterion: ${name}. Use --${name} <0-1>`);
      process.exit(1);
    }
    const num = parseFloat(val);
    if (isNaN(num) || num < 0 || num > 1) {
      console.error(`Invalid score for ${name}: must be 0.0-1.0`);
      process.exit(1);
    }
    scores[name] = num;
  }

  const evaluatorDid = await getAgentDid(root);
  const now = new Date();
  const { weightedScore, signals } = evaluateContract(fm, scores, evaluatorDid, now);

  // Update contract
  fm.status = "evaluated";
  fm.evaluation.result = scores;

  const content = serializeWorkspaceFile(contract);
  await writeFile(contract.filePath, content, "utf-8");

  console.log(`Evaluated contracts/${slug}.md — weighted score: ${weightedScore}`);
  console.log("");

  // Apply signals to delegate's reputation profile
  const delegateSlug = fm.delegateSlug;
  try {
    const profile = await loadProfile(root, delegateSlug);
    const pfm = profile.frontmatter;
    pfm.lastUpdated = now.toISOString();
    if (!pfm.dimensions) pfm.dimensions = {};

    for (const signal of signals) {
      pfm.signals.push(signal);
      pfm.dimensions[signal.dimension] = updateDimension(
        pfm.dimensions[signal.dimension],
        signal.score,
        now
      );
    }

    const profileContent = serializeWorkspaceFile(profile);
    await writeFile(profile.filePath, profileContent, "utf-8");
    console.log(`Updated reputation/${delegateSlug}.md — reliability: ${weightedScore}`);
  } catch {
    // No existing profile — warn but still complete
    console.log(
      `Note: No reputation profile for ${delegateSlug}. Create one with 'awp reputation signal ${delegateSlug} --agent-did ${fm.delegate} --agent-name <name> ...' to track signals.`
    );
    console.log("Generated signals:");
    for (const s of signals) {
      console.log(`  ${s.dimension}: ${s.score} (${s.message})`);
    }
  }
}
