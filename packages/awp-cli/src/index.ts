#!/usr/bin/env node

import { Command } from "commander";
import { AWP_VERSION } from "@agent-workspace/core";
import { initCommand } from "./commands/init.js";
import { validateCommand } from "./commands/validate.js";
import { inspectCommand } from "./commands/inspect.js";
import {
  identityGenerateCommand,
  identityExportCommand,
} from "./commands/identity.js";
import { memoryLogCommand, memorySearchCommand } from "./commands/memory.js";
import {
  artifactCreateCommand,
  artifactCommitCommand,
  artifactLogCommand,
  artifactListCommand,
  artifactSearchCommand,
  artifactMergeCommand,
} from "./commands/artifact.js";
import {
  reputationQueryCommand,
  reputationSignalCommand,
  reputationListCommand,
} from "./commands/reputation.js";
import {
  contractCreateCommand,
  contractListCommand,
  contractShowCommand,
  contractEvaluateCommand,
} from "./commands/contract.js";

const program = new Command();

program
  .name("awp")
  .description("Agent Workspace Protocol — CLI tool")
  .version(AWP_VERSION);

// awp init [dir]
program
  .command("init")
  .description("Initialize a new AWP workspace")
  .argument("[dir]", "Directory to initialize (defaults to cwd)")
  .option("-n, --name <name>", "Workspace name", "my-agent-workspace")
  .action(initCommand);

// awp validate
program
  .command("validate")
  .description("Validate the current AWP workspace")
  .action(validateCommand);

// awp inspect
program
  .command("inspect")
  .description("Show workspace summary")
  .action(inspectCommand);

// awp identity
const identity = program
  .command("identity")
  .description("Agent identity operations");

identity
  .command("generate")
  .description("Generate a DID for this agent")
  .action(identityGenerateCommand);

identity
  .command("export")
  .description("Export identity as A2A Agent Card")
  .option("-f, --format <format>", "Output format (json)", "json")
  .action(identityExportCommand);

// awp memory
const memory = program
  .command("memory")
  .description("Memory operations");

memory
  .command("log")
  .description("Append an entry to today's memory log")
  .argument("<message>", "The memory entry to log")
  .option("-t, --tags <tags>", "Comma-separated tags")
  .action(memoryLogCommand);

memory
  .command("search")
  .description("Search memory entries")
  .argument("<query>", "Search query")
  .action(memorySearchCommand);

// awp artifact
const artifact = program
  .command("artifact")
  .description("Knowledge artifact operations (SMP)");

artifact
  .command("create")
  .description("Create a new knowledge artifact")
  .argument("<slug>", "Artifact slug (e.g., llm-research)")
  .option("-t, --title <title>", "Artifact title")
  .option("--tags <tags>", "Comma-separated tags")
  .option("--confidence <n>", "Confidence score (0.0-1.0)", parseFloat)
  .action(artifactCreateCommand);

artifact
  .command("commit")
  .description("Record a new version of an artifact")
  .argument("<slug>", "Artifact slug")
  .option("-m, --message <message>", "Commit message")
  .option("--confidence <n>", "Updated confidence score", parseFloat)
  .action(artifactCommitCommand);

artifact
  .command("log")
  .description("Show provenance history of an artifact")
  .argument("<slug>", "Artifact slug")
  .action(artifactLogCommand);

artifact
  .command("list")
  .description("List all artifacts in the workspace")
  .option("--tag <tag>", "Filter by tag")
  .action(artifactListCommand);

artifact
  .command("search")
  .description("Search artifacts by content or metadata")
  .argument("<query>", "Search query")
  .action(artifactSearchCommand);

artifact
  .command("merge")
  .description("Merge source artifact into target (additive)")
  .argument("<target>", "Target artifact slug")
  .argument("<source>", "Source artifact slug")
  .option("-m, --message <message>", "Merge message")
  .action(artifactMergeCommand);

// awp reputation
const reputation = program
  .command("reputation")
  .description("Reputation tracking operations (RDP)");

reputation
  .command("query")
  .description("Query an agent's reputation profile")
  .argument("[slug]", "Agent reputation slug (omit to list all)")
  .option("-d, --dimension <dim>", "Filter by dimension")
  .option("--domain <domain>", "Filter by domain competence")
  .option("--raw", "Show raw scores without decay")
  .action(reputationQueryCommand);

reputation
  .command("signal")
  .description("Log a reputation signal for an agent")
  .argument("<slug>", "Agent reputation slug")
  .requiredOption("--dimension <dim>", "Dimension (reliability, epistemic-hygiene, coordination, domain-competence)")
  .requiredOption("--score <n>", "Score (0.0-1.0)")
  .option("--domain <domain>", "Domain (required for domain-competence)")
  .option("--evidence <ref>", "Evidence reference (e.g., contract:slug, artifact:slug)")
  .option("--message <msg>", "Human-readable note")
  .option("--agent-did <did>", "Agent DID (required for first signal)")
  .option("--agent-name <name>", "Agent name (required for first signal)")
  .action(reputationSignalCommand);

reputation
  .command("list")
  .description("List all tracked agents")
  .action(reputationListCommand);

// awp contract
const contract = program
  .command("contract")
  .description("Delegation contract operations (RDP)");

contract
  .command("create")
  .description("Create a new delegation contract")
  .argument("<slug>", "Contract slug")
  .requiredOption("--delegate <did>", "Delegate agent DID")
  .requiredOption("--delegate-slug <slug>", "Delegate reputation profile slug")
  .requiredOption("--description <text>", "Task description")
  .option("--delegator <did>", "Delegator DID (defaults to workspace agent)")
  .option("--deadline <date>", "Deadline (ISO 8601)")
  .option("--output-format <type>", "Expected output type")
  .option("--output-slug <slug>", "Expected output artifact slug")
  .action(contractCreateCommand);

contract
  .command("list")
  .description("List all contracts")
  .option("--status <state>", "Filter by status (draft, active, completed, evaluated)")
  .action(contractListCommand);

contract
  .command("show")
  .description("Show contract details")
  .argument("<slug>", "Contract slug")
  .action(contractShowCommand);

contract
  .command("evaluate")
  .description("Evaluate a contract and generate reputation signals")
  .argument("<slug>", "Contract slug")
  .option("--completeness <n>", "Completeness score (0.0-1.0)")
  .option("--accuracy <n>", "Accuracy score (0.0-1.0)")
  .option("--clarity <n>", "Clarity score (0.0-1.0)")
  .option("--timeliness <n>", "Timeliness score (0.0-1.0)")
  .action(contractEvaluateCommand);

program.parse();
