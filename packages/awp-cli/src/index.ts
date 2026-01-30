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

program.parse();
