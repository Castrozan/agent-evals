import { inheritedEnvironment } from "../inheritedEnvironment.js";
import type { EffortLevel, Options } from "@anthropic-ai/claude-agent-sdk";
import type { SessionPosture, SubjectInvocation } from "../../../domain/ports.js";

const READ_TOOLS = ["Read", "Glob", "Grep", "Skill"];
const WRITE_TOOLS = [...READ_TOOLS, "Write", "Edit", "Bash"];

const CONFINED_BASH = {
  enabled: true,
  autoAllowBashIfSandboxed: true,
  allowUnsandboxedCommands: false,
  failIfUnavailable: true,
};

const TOOLS_BY_POSTURE: Record<SessionPosture, string[]> = {
  none: [],
  "read-only": READ_TOOLS,
  write: WRITE_TOOLS,
};

export function claudeQueryOptions(invocation: SubjectInvocation, abortController: AbortController): Options {
  const tools = TOOLS_BY_POSTURE[invocation.posture];
  const options: Options = {
    cwd: invocation.workingDirectory,
    model: invocation.model,
    tools,
    allowedTools: tools,
    settingSources: invocation.isolatedContext ? [] : ["project"],
    env: inheritedEnvironment(invocation),
    abortController,
    plugins: invocation.pluginDirectories.map((directory) => ({ type: "local", path: directory })),
    ...(invocation.posture === "write"
      ? {
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          sandbox: CONFINED_BASH,
        }
      : { permissionMode: "dontAsk" }),
  };
  if (invocation.effort) options.effort = invocation.effort as EffortLevel;
  if (invocation.systemPrompt) {
    options.systemPrompt = { type: "preset", preset: "claude_code", append: invocation.systemPrompt };
  }
  return options;
}
