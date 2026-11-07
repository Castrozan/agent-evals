import type { CodexOptions, ModelReasoningEffort, SandboxMode, ThreadOptions } from "@openai/codex-sdk";
import type { SubjectInvocation } from "../domain/ports.js";

const DISABLED_FEATURES = {
  apps: false,
  browser_use: false,
  code_mode_host: false,
  computer_use: false,
  image_generation: false,
  multi_agent: false,
  plugins: false,
  shell_tool: false,
  unified_exec: false,
};

type ConfigObject = NonNullable<CodexOptions["config"]>;

function processEnvironment(overrides: Record<string, string>): Record<string, string> {
  const inherited = Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined);
  return { ...Object.fromEntries(inherited), ...overrides };
}

function sandboxMode(invocation: SubjectInvocation): SandboxMode {
  if (invocation.posture !== "write") return "read-only";
  return invocation.stagesGit ? "danger-full-access" : "workspace-write";
}

export function codexClientOptions(invocation: SubjectInvocation, codexHome?: string): CodexOptions {
  const config: ConfigObject = {};
  if (invocation.systemPrompt) config.developer_instructions = invocation.systemPrompt;
  if (invocation.posture === "none") {
    config.apps = { _default: { enabled: false } };
    config.mcp_servers = {};
    config.tools = { view_image: false, web_search: false };
    config.features = { ...DISABLED_FEATURES };
  }
  if (invocation.isolatedContext) {
    config.features = { ...(config.features as ConfigObject | undefined), hooks: false };
    config.project_doc_max_bytes = 0;
  }
  const environment = processEnvironment(invocation.environment);
  if (codexHome) environment.CODEX_HOME = codexHome;
  return {
    env: environment,
    ...(Object.keys(config).length > 0 ? { config } : {}),
    ...(invocation.pluginDirectories.length > 0 ? { codexPathOverride: "codex" } : {}),
  };
}

export function codexThreadOptions(invocation: SubjectInvocation): ThreadOptions {
  return {
    model: invocation.model,
    sandboxMode: sandboxMode(invocation),
    approvalPolicy: "never",
    networkAccessEnabled: false,
    webSearchEnabled: false,
    webSearchMode: "disabled",
    workingDirectory: invocation.workingDirectory,
    skipGitRepoCheck: true,
    ...(invocation.effort ? { modelReasoningEffort: invocation.effort as ModelReasoningEffort } : {}),
  };
}
