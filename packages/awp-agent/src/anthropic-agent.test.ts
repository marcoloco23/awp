import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
    constructor(_opts: { apiKey?: string } = {}) {}
  },
}));

import { AnthropicAgent } from "./anthropic-agent.js";
import { AWP_TOOLS } from "./tools.js";

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-ant-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "t",
      id: "urn:awp:workspace:t",
      agent: { did: "did:awp:ant", identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("\n# Bot\n", { awp: "1.0.0", type: "identity", name: "Bot", did: "did:awp:ant" }),
  );
  return dir;
}

let ws: string;
beforeEach(async () => {
  ws = await makeWorkspace();
  createMock.mockReset();
});
afterEach(async () => {
  await rm(ws, { recursive: true, force: true });
});

describe("AnthropicAgent.executeTask", () => {
  it("completes when the model emits a tool_use for task_complete", async () => {
    createMock.mockResolvedValueOnce({
      content: [
        { type: "text", text: "calling task_complete" },
        { type: "tool_use", id: "tu1", name: "task_complete", input: { summary: "done" } },
      ],
      stop_reason: "tool_use",
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const agent = new AnthropicAgent("a", ws, "claude-test", "sk-fake");
    const result = await agent.executeTask({
      contractId: "contract:t",
      description: "do",
      tools: AWP_TOOLS,
    });

    expect(result.success).toBe(true);
    expect(result.tokens.input).toBe(100);
    expect(result.tokens.output).toBe(50);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("task_complete");
  });

  it("stops on end_turn with no tools", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "nothing to do" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 5, output_tokens: 5 },
    });
    const agent = new AnthropicAgent("a", ws, "claude-test", "sk-fake");
    const result = await agent.executeTask({
      contractId: "contract:t",
      description: "trivial",
      tools: AWP_TOOLS,
    });
    expect(result.success).toBe(true);
    expect(result.output).toContain("nothing to do");
  });

  it("captures SDK errors", async () => {
    createMock.mockRejectedValueOnce(new Error("Anthropic 500"));
    const agent = new AnthropicAgent("a", ws, "claude-test", "sk-fake");
    const result = await agent.executeTask({
      contractId: "contract:t",
      description: "x",
      tools: AWP_TOOLS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Anthropic 500");
  });

  it("converts AWP tools to Anthropic Tool schema", async () => {
    createMock.mockResolvedValueOnce({
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    const agent = new AnthropicAgent("a", ws, "claude-test", "sk-fake");
    await agent.executeTask({ contractId: "contract:t", description: "x", tools: AWP_TOOLS });
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.model).toBe("claude-test");
    expect(callArgs.tools[0]).toMatchObject({ name: expect.any(String), description: expect.any(String) });
    expect(callArgs.tools[0].input_schema).toBeDefined();
  });
});
