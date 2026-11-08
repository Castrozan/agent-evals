import { mkdtemp, rm } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInvocation } from "../__fixtures__/invocation.js";

const constructorMock = vi.hoisted(() => vi.fn());
const startThreadMock = vi.hoisted(() => vi.fn());
const runStreamedMock = vi.hoisted(() => vi.fn());
const sandboxMock = vi.hoisted(() => vi.fn());

vi.mock("./codexSandbox.js", () => ({ sandboxCodex: sandboxMock }));

vi.mock("@openai/codex-sdk", () => ({
  Codex: class {
    constructor(options: unknown) {
      constructorMock(options);
    }
    startThread(options: unknown) {
      startThreadMock(options);
      return { runStreamed: runStreamedMock };
    }
  },
}));

import { codexSubjectClient } from "./codexClient.js";

function streamOf(events: unknown[]) {
  runStreamedMock.mockResolvedValue({
    events: (async function* () {
      for (const event of events) yield event;
    })(),
  });
}

const codexInvocation = (overrides = {}) => buildInvocation({ client: "codex", ...overrides });

describe("codex subject client", () => {
  beforeEach(() => {
    constructorMock.mockReset();
    startThreadMock.mockReset();
    runStreamedMock.mockReset();
  });

  it("builds the transcript from thread events", async () => {
    streamOf([
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "cat .agents/skills/demo/SKILL.md",
          aggregated_output: "abcd",
          status: "completed",
        },
      },
      {
        type: "item.completed",
        item: {
          type: "mcp_tool_call",
          server: "s",
          tool: "lookup",
          arguments: {},
          status: "completed",
          result: { content: [{ type: "text", text: "xyz" }] },
        },
      },
      { type: "item.completed", item: { type: "agent_message", text: "pronto" } },
      {
        type: "turn.completed",
        usage: {
          input_tokens: 100,
          cached_input_tokens: 40,
          cache_write_input_tokens: 0,
          output_tokens: 20,
          reasoning_output_tokens: 5,
        },
      },
    ]);
    const transcript = await codexSubjectClient.run(codexInvocation());
    expect(transcript.text).toBe("pronto");
    expect(transcript.skillsUsed).toEqual(["demo"]);
    expect(transcript.toolsUsed).toEqual(["shell", "lookup"]);
    expect(transcript.toolOutputCharacters).toBe(7);
    expect(transcript.tokenUsage).toEqual({ input: 60, output: 15, cacheRead: 40, cacheWrite: 0, reasoning: 5 });
  });

  it("maps the none posture to disabled tools and read-only sandbox", async () => {
    streamOf([]);
    await codexSubjectClient.run(codexInvocation({ posture: "none", systemPrompt: "regra", effort: "medium" }));
    const options = constructorMock.mock.calls[0]?.[0];
    expect(options.config.developer_instructions).toBe("regra");
    expect(options.config.mcp_servers).toEqual({});
    expect(options.config.features.shell_tool).toBe(false);
    expect(startThreadMock.mock.calls[0]?.[0]).toMatchObject({
      sandboxMode: "read-only",
      networkAccessEnabled: false,
      modelReasoningEffort: "medium",
    });
  });

  it("confines a git-staging write session to the bubblewrap sandbox", async () => {
    streamOf([]);
    const sessionRoot = await mkdtemp("/tmp/agent-evals-test-session-");
    const dispose = vi.fn();
    sandboxMock.mockResolvedValue({ binary: "/sandbox/codex", dispose });
    const confined = await codexSubjectClient.run(
      codexInvocation({
        posture: "write",
        stagesGit: true,
        sessionRoot,
        workingDirectory: sessionRoot,
        environment: { CODEX_HOME: sessionRoot },
      }),
    );
    expect(confined.instrumentFailure).toBeUndefined();
    await codexSubjectClient.run(codexInvocation({ posture: "write", stagesGit: false }));
    expect(startThreadMock.mock.calls[0]?.[0].sandboxMode).toBe("danger-full-access");
    expect(constructorMock.mock.calls[0]?.[0].codexPathOverride).toBe("/sandbox/codex");
    expect(sandboxMock.mock.calls[0]?.[0]).toMatchObject({ writableRoot: sessionRoot, codexHome: sessionRoot });
    expect(dispose).toHaveBeenCalled();
    expect(sandboxMock).toHaveBeenCalledTimes(1);
    expect(startThreadMock.mock.calls[1]?.[0].sandboxMode).toBe("workspace-write");
    expect(constructorMock.mock.calls[1]?.[0].codexPathOverride).toBeUndefined();
    await rm(sessionRoot, { recursive: true, force: true });
  });

  it("passes the subject environment and the PATH codex for plugin cases", async () => {
    streamOf([]);
    await codexSubjectClient.run(
      codexInvocation({ environment: { CODEX_HOME: "/privado" }, pluginDirectories: ["/plugins/a"] }),
    );
    const options = constructorMock.mock.calls[0]?.[0];
    expect(options.env.CODEX_HOME).toBe("/privado");
    expect(options.codexPathOverride).toBe("codex");
  });

  it("isolates the judge context with a private home that links the credentials", async () => {
    streamOf([]);
    const userHome = await mkdtemp("/tmp/agent-evals-test-home-");
    await import("node:fs/promises").then(({ writeFile }) => writeFile(`${userHome}/auth.json`, "{}"));
    await codexSubjectClient.run(codexInvocation({ isolatedContext: true, environment: { CODEX_HOME: userHome } }));
    const options = constructorMock.mock.calls[0]?.[0];
    expect(options.config.project_doc_max_bytes).toBe(0);
    expect(options.env.CODEX_HOME).not.toBe(userHome);
    await rm(userHome, { recursive: true, force: true });
  });

  it("returns a credential failure from a failed turn", async () => {
    streamOf([{ type: "turn.failed", error: { message: "401 Unauthorized" } }]);
    const transcript = await codexSubjectClient.run(codexInvocation());
    expect(transcript.instrumentFailure?.kind).toBe("credential");
  });

  it("returns a client error when the stream throws", async () => {
    runStreamedMock.mockRejectedValue(new Error("falha qualquer"));
    const transcript = await codexSubjectClient.run(codexInvocation());
    expect(transcript.instrumentFailure).toEqual({ kind: "client-error", message: "falha qualquer" });
  });

  it("reports the installed SDK version", async () => {
    await expect(codexSubjectClient.sdkVersion()).resolves.toMatch(/^\d+\.\d+\.\d+/);
  });
});
