import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInvocation } from "../__fixtures__/invocation.js";

const serverMock = vi.hoisted(() => ({ start: vi.fn(), close: vi.fn() }));
const sessionMock = vi.hoisted(() => ({
  create: vi.fn(),
  prompt: vi.fn(),
  wait: vi.fn(),
  list: vi.fn(),
}));

vi.mock("./opencodeServer.js", () => ({ startOpencodeServer: serverMock.start }));
vi.mock("@opencode/client", () => ({
  OpenCode: {
    make: () => ({
      session: { create: sessionMock.create, prompt: sessionMock.prompt },
      experimental: { session: { wait: sessionMock.wait } },
      message: { list: sessionMock.list },
    }),
  },
}));

import { opencodeSubjectClient } from "./opencodeClient.js";

const invocation = (overrides = {}) => buildInvocation({ client: "opencode", model: "prov/modelo", ...overrides });

describe("opencode subject client", () => {
  beforeEach(() => {
    for (const mock of [serverMock.start, serverMock.close, ...Object.values(sessionMock)]) mock.mockReset();
    serverMock.start.mockResolvedValue({ baseUrl: "http://127.0.0.1:1", password: "p", close: serverMock.close });
    sessionMock.create.mockResolvedValue({ id: "s1" });
    sessionMock.list.mockResolvedValue({
      data: [
        { type: "skill", name: "demo" },
        {
          type: "assistant",
          content: [
            {
              type: "tool",
              name: "read",
              state: { status: "completed", input: {}, content: [{ type: "text", text: "abc" }] },
            },
            { type: "text", text: "resposta" },
          ],
          tokens: { input: 10, output: 5, reasoning: 2, cache: { read: 3, write: 1 } },
          cost: 0.5,
        },
      ],
      cursor: {},
    });
  });

  it("builds the transcript and stops the server", async () => {
    const transcript = await opencodeSubjectClient.run(invocation());
    expect(transcript.text).toBe("resposta");
    expect(transcript.skillsUsed).toEqual(["demo"]);
    expect(transcript.toolsUsed).toEqual(["read"]);
    expect(transcript.toolOutputCharacters).toBe(3);
    expect(transcript.tokenUsage).toEqual({ input: 10, output: 5, cacheRead: 3, cacheWrite: 1, reasoning: 2 });
    expect(transcript.costUsd).toBe(0.5);
    expect(serverMock.close).toHaveBeenCalledOnce();
    expect(sessionMock.create.mock.calls[0]?.[0].model).toEqual({ providerID: "prov", id: "modelo" });
  });

  it("maps postures to permissions with bash and webfetch always denied", async () => {
    await opencodeSubjectClient.run(invocation({ posture: "write", systemPrompt: "regra" }));
    const configuration = serverMock.start.mock.calls[0]?.[0].configuration;
    const agent = configuration.agents["agent-eval"];
    expect(agent.system).toBe("regra");
    expect(agent.permissions).toContainEqual({ action: "edit", resource: "*", effect: "allow" });
    expect(agent.permissions.at(-2)).toEqual({ action: "bash", resource: "*", effect: "deny" });
    expect(agent.permissions.at(-1)).toEqual({ action: "webfetch", resource: "*", effect: "deny" });
    await opencodeSubjectClient.run(invocation({ posture: "none" }));
    const none = serverMock.start.mock.calls[1]?.[0].configuration.agents["agent-eval"];
    expect(none.permissions.filter((rule: { effect: string }) => rule.effect === "allow")).toEqual([]);
  });

  it("returns an assistant error as an instrument failure", async () => {
    sessionMock.list.mockResolvedValue({
      data: [{ type: "assistant", content: [], error: { type: "auth", message: "401 Unauthorized" } }],
      cursor: {},
    });
    const transcript = await opencodeSubjectClient.run(invocation());
    expect(transcript.instrumentFailure?.kind).toBe("credential");
  });

  it("still closes the server when the session throws", async () => {
    sessionMock.prompt.mockRejectedValue(new Error("boom"));
    const transcript = await opencodeSubjectClient.run(invocation());
    expect(transcript.instrumentFailure).toEqual({ kind: "client-error", message: "boom" });
    expect(serverMock.close).toHaveBeenCalledOnce();
  });

  it("rejects effort and subject environment as configuration errors", async () => {
    await expect(opencodeSubjectClient.run(invocation({ effort: "high" }))).rejects.toThrow(/esforço/);
    await expect(opencodeSubjectClient.run(invocation({ environment: { A: "1" } }))).rejects.toThrow(/ambiente/);
    await expect(opencodeSubjectClient.run(invocation({ model: "semprovedor" }))).rejects.toThrow(/provedor\/modelo/);
  });
});
