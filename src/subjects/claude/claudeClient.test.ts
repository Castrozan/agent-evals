import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInvocation } from "../__fixtures__/invocation.js";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({ query: queryMock }));

import { claudeSubjectClient } from "./claudeClient.js";

function fakeQuery(messages: unknown[], failure?: Error) {
  const close = vi.fn();
  const iterator = (async function* () {
    for (const message of messages) yield message;
    if (failure) throw failure;
  })();
  return Object.assign(iterator, { close });
}

const successMessages = [
  {
    type: "assistant",
    message: {
      content: [
        { type: "tool_use", name: "Skill", input: { skill: "demo" } },
        { type: "tool_use", name: "mcp__server__lookup", input: {} },
      ],
    },
  },
  { type: "user", message: { content: [{ type: "tool_result", content: "12345" }] } },
  {
    type: "result",
    subtype: "success",
    is_error: false,
    result: "resposta final",
    total_cost_usd: 0.25,
    modelUsage: {
      "model-x": {
        inputTokens: 10,
        outputTokens: 30,
        thinkingTokens: 5,
        cacheReadInputTokens: 7,
        cacheCreationInputTokens: 3,
      },
    },
  },
];

describe("claude subject client", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("builds the transcript from the message stream", async () => {
    queryMock.mockReturnValue(fakeQuery(successMessages));
    const transcript = await claudeSubjectClient.run(buildInvocation());
    expect(transcript.text).toBe("resposta final");
    expect(transcript.skillsUsed).toEqual(["demo"]);
    expect(transcript.toolsUsed).toEqual(["Skill", "lookup"]);
    expect(transcript.toolOutputCharacters).toBe(5);
    expect(transcript.costUsd).toBe(0.25);
    expect(transcript.tokenUsage).toEqual({ input: 10, output: 25, cacheRead: 7, cacheWrite: 3, reasoning: 5 });
    expect(transcript.instrumentFailure).toBeUndefined();
  });

  it("maps postures, isolation, plugins and system prompt to SDK options", async () => {
    queryMock.mockReturnValue(fakeQuery(successMessages));
    await claudeSubjectClient.run(
      buildInvocation({
        posture: "write",
        isolatedContext: true,
        effort: "high",
        systemPrompt: "regra",
        pluginDirectories: ["/plugins/a"],
        environment: { CHAVE: "valor" },
      }),
    );
    const options = queryMock.mock.calls[0]?.[0].options;
    expect(options.tools).toEqual(["Read", "Glob", "Grep", "Skill", "Write", "Edit", "Bash"]);
    expect(options.permissionMode).toBe("bypassPermissions");
    expect(options.sandbox).toMatchObject({ enabled: true, allowUnsandboxedCommands: false, failIfUnavailable: true });
    expect(options.settingSources).toEqual([]);
    expect(options.effort).toBe("high");
    expect(options.systemPrompt).toEqual({ type: "preset", preset: "claude_code", append: "regra" });
    expect(options.plugins).toEqual([{ type: "local", path: "/plugins/a" }]);
    expect(options.env.CHAVE).toBe("valor");
    expect(options.cwd).toBe("/tmp/sessao");
  });

  it("gives the none posture no tools and the project setting source", async () => {
    queryMock.mockReturnValue(fakeQuery(successMessages));
    await claudeSubjectClient.run(buildInvocation({ posture: "none" }));
    const options = queryMock.mock.calls[0]?.[0].options;
    expect(options.tools).toEqual([]);
    expect(options.allowedTools).toEqual([]);
    expect(options.settingSources).toEqual(["project"]);
    expect(options.permissionMode).toBe("dontAsk");
  });

  it("returns a session-limit failure instead of throwing", async () => {
    queryMock.mockReturnValue(
      fakeQuery([
        {
          type: "result",
          subtype: "success",
          is_error: true,
          result: "You've hit your limit",
          total_cost_usd: 0,
          modelUsage: {},
        },
      ]),
    );
    const transcript = await claudeSubjectClient.run(buildInvocation());
    expect(transcript.instrumentFailure?.kind).toBe("session-limit");
    expect(transcript.text).toBe("");
  });

  it("classifies a thrown process error", async () => {
    queryMock.mockReturnValue(fakeQuery([], new Error("Claude Code process was killed by SIGKILL")));
    const transcript = await claudeSubjectClient.run(buildInvocation());
    expect(transcript.instrumentFailure?.kind).toBe("killed");
  });

  it("aborts on timeout and reports it", async () => {
    queryMock.mockImplementation((...parameters: unknown[]) => {
      const { options } = parameters[0] as { options: { abortController: AbortController } };
      const iterator = (async function* () {
        await new Promise((_, reject) =>
          options.abortController.signal.addEventListener("abort", () => reject(new Error("aborted"))),
        );
        yield {};
      })();
      return Object.assign(iterator, { close: vi.fn() });
    });
    const transcript = await claudeSubjectClient.run(buildInvocation({ timeoutMs: 20 }));
    expect(transcript.instrumentFailure?.kind).toBe("timeout");
  });

  it("lists visible skills by asking the session", async () => {
    queryMock.mockReturnValue(
      fakeQuery([
        {
          type: "result",
          subtype: "success",
          is_error: false,
          result: "- alpha\n- beta:gamma\n",
          total_cost_usd: 0,
          modelUsage: {},
        },
      ]),
    );
    await expect(claudeSubjectClient.visibleSkills(buildInvocation({ posture: "none" }))).resolves.toEqual([
      "alpha",
      "beta:gamma",
    ]);
    expect(queryMock.mock.calls[0]?.[0].options.tools).toContain("Skill");
  });

  it("reads the installed SDK version", async () => {
    await expect(claudeSubjectClient.sdkVersion()).resolves.toMatch(/^\d+\.\d+\.\d+/);
  });
});
