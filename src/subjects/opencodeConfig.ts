import { SubjectConfigurationError } from "./configurationError.js";
import type { SessionPosture, SubjectInvocation } from "../domain/ports.js";

export const OPENCODE_AGENT_NAME = "agent-eval";

const READ_ACTIONS = ["read", "grep", "glob", "list", "skill"];
const WRITE_ACTIONS = [...READ_ACTIONS, "edit", "write"];

const ALLOWED_ACTIONS: Record<SessionPosture, string[]> = {
  none: [],
  "read-only": READ_ACTIONS,
  write: WRITE_ACTIONS,
};

export interface OpencodeModelReference {
  providerID: string;
  id: string;
  variant?: string;
}

export function splitOpencodeModel(model: string): OpencodeModelReference {
  const separator = model.indexOf("/");
  if (separator <= 0 || separator === model.length - 1) {
    throw new SubjectConfigurationError(
      `Modelo "${model}" inválido para o cliente opencode: use o formato provedor/modelo.`,
    );
  }
  const [id = "", variant] = model.slice(separator + 1).split("#");
  return { providerID: model.slice(0, separator), id, ...(variant ? { variant } : {}) };
}

export function opencodeServerConfiguration(invocation: SubjectInvocation): Record<string, unknown> {
  const permissions = [
    { action: "*", resource: "*", effect: "deny" },
    ...ALLOWED_ACTIONS[invocation.posture].map((action) => ({ action, resource: "*", effect: "allow" })),
    { action: "bash", resource: "*", effect: "deny" },
    { action: "webfetch", resource: "*", effect: "deny" },
  ];
  const agent = {
    mode: "primary",
    permissions,
    ...(invocation.systemPrompt ? { system: invocation.systemPrompt } : {}),
  };
  return { agents: { [OPENCODE_AGENT_NAME]: agent } };
}

export function validateOpencodeInvocation(invocation: SubjectInvocation): void {
  if (invocation.effort) {
    throw new SubjectConfigurationError(
      `O cliente opencode não aceita esforço, mas "${invocation.effort}" foi declarado.`,
    );
  }
  if (Object.keys(invocation.environment).length > 0) {
    throw new SubjectConfigurationError("O cliente opencode não aceita ambiente do sujeito.");
  }
  if (invocation.pluginDirectories.length > 0) {
    throw new SubjectConfigurationError("O cliente opencode não aceita plugins.");
  }
}
