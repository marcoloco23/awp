#!/usr/bin/env node

/**
 * AWP MCP Server
 *
 * MCP server exposing Agent Workspace Protocol operations.
 * Plug any AWP workspace into any MCP client.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AWP_VERSION } from "@agent-workspace/core";

// Tool registration modules
import { registerIdentityTools } from "./tools/identity.js";
import { registerMemoryTools } from "./tools/memory.js";
import { registerArtifactTools } from "./tools/artifact.js";
import { registerStatusTools } from "./tools/status.js";
import { registerReputationTools } from "./tools/reputation.js";
import { registerContractTools } from "./tools/contract.js";
import { registerProjectTools } from "./tools/project.js";
import { registerTaskTools } from "./tools/task.js";
import { registerConfigTools } from "./tools/config.js";
import { registerSwarmTools } from "./tools/swarm.js";
import { registerSyncTools } from "./tools/sync.js";
import { registerExperimentTools } from "./tools/experiment.js";

// Create MCP server
const server = new McpServer({
  name: "awp-workspace",
  version: AWP_VERSION,
});

// Register all tool groups
registerIdentityTools(server);
registerMemoryTools(server);
registerArtifactTools(server);
registerStatusTools(server);
registerReputationTools(server);
registerContractTools(server);
registerProjectTools(server);
registerTaskTools(server);
registerConfigTools(server);
registerSwarmTools(server);
registerSyncTools(server);
registerExperimentTools(server);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
