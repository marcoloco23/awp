#!/usr/bin/env node

import { Command } from "commander";
import { AWP_VERSION } from "@agent-workspace/core";
import { initCommand } from "./commands/init.js";
import { validateCommand } from "./commands/validate.js";
import { inspectCommand } from "./commands/inspect.js";
import { identityGenerateCommand, identityExportCommand } from "./commands/identity.js";
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
import {
  projectCreateCommand,
  projectListCommand,
  projectShowCommand,
  projectCloseCommand,
} from "./commands/project.js";
import {
  taskCreateCommand,
  taskListCommand,
  taskUpdateCommand,
  taskShowCommand,
} from "./commands/task.js";
import { statusCommand } from "./commands/status.js";

const program = new Command();

program.name("awp").description("Agent Workspace Protocol — CLI tool").version(AWP_VERSION);

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
  .option("--quick", "Only validate core files (skip content directories)")
  .action(validateCommand);

// awp inspect
program.command("inspect").description("Show workspace summary").action(inspectCommand);

// awp identity
const identity = program.command("identity").description("Agent identity operations");

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
const memory = program.command("memory").description("Memory operations");

memory
  .command("log")
  .description("Append an entry to today's memory log")
  .argument("<message>", "The memory entry to log")
  .option("-t, --tags <tags>", "Comma-separated tags")
  .action(memoryLogCommand);

memory
  .command("search")
  .description("Search memory entries with optional fuzzy matching and date filters")
  .argument("<query>", "Search query")
  .option("--from <date>", "Start date (YYYY-MM-DD)")
  .option("--to <date>", "End date (YYYY-MM-DD)")
  .option("--tag <tag>", "Filter by tag")
  .option("--fuzzy", "Enable fuzzy matching")
  .option("--limit <n>", "Limit number of results")
  .action(memorySearchCommand);

// awp artifact
const artifact = program.command("artifact").description("Knowledge artifact operations (SMP)");

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
  .description("Merge source artifact into target")
  .argument("<target>", "Target artifact slug")
  .argument("<source>", "Source artifact slug")
  .option("-m, --message <message>", "Merge message")
  .option("-s, --strategy <strategy>", "Merge strategy (additive, authority)", "additive")
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
  .requiredOption(
    "--dimension <dim>",
    "Dimension (reliability, epistemic-hygiene, coordination, domain-competence)"
  )
  .requiredOption("--score <n>", "Score (0.0-1.0)")
  .option("--domain <domain>", "Domain (required for domain-competence)")
  .option("--evidence <ref>", "Evidence reference (e.g., contract:slug, artifact:slug)")
  .option("--message <msg>", "Human-readable note")
  .option("--agent-did <did>", "Agent DID (required for first signal)")
  .option("--agent-name <name>", "Agent name (required for first signal)")
  .action(reputationSignalCommand);

reputation.command("list").description("List all tracked agents").action(reputationListCommand);

// awp contract
const contract = program.command("contract").description("Delegation contract operations (RDP)");

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

// awp project
const project = program.command("project").description("Project coordination operations (CDP)");

project
  .command("create")
  .description("Create a new project")
  .argument("<slug>", "Project slug (e.g., q3-product-launch)")
  .option("-t, --title <title>", "Project title")
  .option("--deadline <date>", "Deadline (ISO 8601 date or YYYY-MM-DD)")
  .option("--tags <tags>", "Comma-separated tags")
  .action(projectCreateCommand);

project
  .command("list")
  .description("List all projects")
  .option("--status <state>", "Filter by status (draft, active, paused, completed, archived)")
  .action(projectListCommand);

project
  .command("show")
  .description("Show project details with task summary")
  .argument("<slug>", "Project slug")
  .action(projectShowCommand);

project
  .command("close")
  .description("Mark a project as completed")
  .argument("<slug>", "Project slug")
  .action(projectCloseCommand);

// awp task
const task = program.command("task").description("Task management operations (CDP)");

task
  .command("create")
  .description("Create a task within a project")
  .argument("<project>", "Project slug")
  .argument("<slug>", "Task slug")
  .option("-t, --title <title>", "Task title")
  .option("--assignee <did>", "Assignee agent DID")
  .option("--assignee-slug <slug>", "Assignee reputation profile slug")
  .option("--priority <level>", "Priority (low, medium, high, critical)", "medium")
  .option("--deadline <date>", "Deadline (ISO 8601 date or YYYY-MM-DD)")
  .option("--blocked-by <ids>", "Comma-separated task IDs that block this task")
  .option("--output-artifact <slug>", "Output artifact slug")
  .option("--contract <slug>", "Associated contract slug")
  .action(taskCreateCommand);

task
  .command("list")
  .description("List tasks for a project")
  .argument("<project>", "Project slug")
  .option("--status <state>", "Filter by status")
  .option("--assignee <slug>", "Filter by assignee slug")
  .action(taskListCommand);

task
  .command("update")
  .description("Update a task's status or assignee")
  .argument("<project>", "Project slug")
  .argument("<slug>", "Task slug")
  .option(
    "--status <state>",
    "New status (pending, in-progress, blocked, review, completed, cancelled)"
  )
  .option("--assignee <did>", "New assignee DID")
  .option("--assignee-slug <slug>", "New assignee reputation profile slug")
  .action(taskUpdateCommand);

task
  .command("show")
  .description("Show task details")
  .argument("<project>", "Project slug")
  .argument("<slug>", "Task slug")
  .action(taskShowCommand);

// awp status
program
  .command("status")
  .description("Rich workspace overview — projects, tasks, reputation, health")
  .action(statusCommand);

program.parse();
