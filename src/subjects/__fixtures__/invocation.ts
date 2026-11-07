import type { SubjectInvocation } from "../../domain/ports.js";

export function buildInvocation(overrides: Partial<SubjectInvocation> = {}): SubjectInvocation {
  return {
    client: "claude",
    model: "model-x",
    prompt: "pergunta",
    workingDirectory: "/tmp/sessao",
    posture: "read-only",
    stagesGit: false,
    pluginDirectories: [],
    environment: {},
    timeoutMs: 5000,
    isolatedContext: false,
    ...overrides,
  };
}
