import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CliCase } from "../../../domain/cases.js";
import type { SubjectClient, SubjectInvocation } from "../../../domain/ports.js";

export const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
export const fixture = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "mcp",
  "__fixtures__",
  "echoServer.mjs",
);

export function fakeClient(
  replyFor: (invocation: SubjectInvocation) => string,
): SubjectClient & { invocations: SubjectInvocation[] } {
  const invocations: SubjectInvocation[] = [];
  return {
    client: "claude",
    invocations,
    async run(invocation) {
      invocations.push(invocation);
      return {
        text: replyFor(invocation),
        skillsUsed: [],
        toolsUsed: [],
        commandsRun: [],
        tokenUsage: usage,
        toolOutputCharacters: 0,
        durationMs: 2,
      };
    },
    visibleSkills: async () => [],
    sdkVersion: async () => "9.9",
  };
}

export const stager = {
  async stage() {
    const directory = await mkdtemp(path.join(os.tmpdir(), "session-"));
    return {
      root: directory,
      sessionDirectory: directory,
      pluginDirectories: [],
      environment: {},
      dispose: async () => undefined,
    };
  },
};

export const cliCase = (overrides: Partial<CliCase> = {}): CliCase => ({
  category: "cli",
  name: "eco",
  level: "unit",
  sourceFile: "x",
  pending: false,
  heldOut: false,
  type: "cli",
  command: "cat; echo done",
  stdin: "entrada",
  exitCode: 0,
  assertions: {
    judge: [],
    equals: [],
    contains: ["entrada"],
    notContains: [],
    regex: [],
    notRegex: [],
    skillsUsed: [],
    skillsForbidden: [],
    toolsUsed: [],
    toolsForbidden: [],
    commandsRun: [],
    commandsRunForbidden: [],
    generatedFiles: [],
    commands: [],
    judgeOnCommand: [],
  },
  ...overrides,
});
