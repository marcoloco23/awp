import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Mock OpenAI SDK before importing the agent
// ---------------------------------------------------------------------------

const createMock = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = { completions: { create: createMock } };
      constructor(_opts: { apiKey?: string } = {}) {}
    },
  };
});

import { OpenAIAgent } from "./openai-agent.js";
import { AWP_TOOLS } from "./tools.js";

async function makeWorkspace(): Promise<string> {
  const dir = join(tmpdir(), `awp-oa-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(join(dir, ".awp"), { recursive: true });
  await writeFile(
    join(dir, ".awp", "workspace.json"),
    JSON.stringify({
      awp: "1.0.0",
      name: "t",
      id: "urn:awp:workspace:t",
      agent: { did: "did:awp:openai-agent", identityFile: "IDENTITY.md" },
    }),
  );
  await writeFile(
    join(dir, "IDENTITY.md"),
    matter.stringify("\n# Bot\n", { awp: "1.0.0", type: "identity", name: "Bot", did: "did:awp:openai-agent" }),
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

describe("OpenAIAgent.executeTask", () => {
  it("completes when the model calls task_complete", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        {
          finish_reason: "tool_calls",
          message: {
            role: "assistant",
            content: "calling task_complete",
            tool_calls: [
              {
                id: "tc1",
                type: "function",
                function: {
                  name: "task_complete",
                  arguments: JSON.stringify({ summary: "all done" }),
                },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    const agent = new OpenAIAgent("a", ws, "gpt-test", "sk-fake");
    const result = await agent.executeTask({
      contractId: "contract:test",
      description: "Do the thing",
      tools: AWP_TOOLS,
    });

    expect(result.success).toBe(true);
    expect(result.tokens.input).toBe(100);
    expect(result.tokens.output).toBe(50);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("task_complete");
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("stops naturally on finish_reason=stop with no tool calls", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        { finish_reason: "stop", message: { role: "assistant", content: "fine without tools" } },
      ],
      usage: { prompt_tokens: 50, completion_tokens: 25 },
    });

    const agent = new OpenAIAgent("a", ws, "gpt-test", "sk-fake");
    const result = await agent.executeTask({
      contractId: "contract:t",
      description: "trivial",
      tools: AWP_TOOLS,
    });

    expect(result.success).toBe(true);
    expect(result.output).toContain("fine without tools");
  });

  it("captures errors from the OpenAI client", async () => {
    createMock.mockRejectedValueOnce(new Error("OpenAI is down"));
    const agent = new OpenAIAgent("a", ws, "gpt-test", "sk-fake");
    const result = await agent.executeTask({
      contractId: "contract:t",
      description: "x",
      tools: AWP_TOOLS,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("OpenAI is down");
  });

  it("passes tools to the OpenAI API call", async () => {
    createMock.mockResolvedValueOnce({
      choices: [
        { finish_reason: "stop", message: { role: "assistant", content: "ok" } },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    });
    const agent = new OpenAIAgent("a", ws, "gpt-test", "sk-fake");
    await agent.executeTask({
      contractId: "contract:t",
      description: "x",
      tools: AWP_TOOLS,
    });
    const callArgs = createMock.mock.calls[0][0];
    expect(callArgs.model).toBe("gpt-test");
    expect(Array.isArray(callArgs.tools)).toBe(true);
    expect(callArgs.tools.length).toBeGreaterThan(0);
  });
});
