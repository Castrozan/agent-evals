import type { ClientName } from "../../domain/clients.js";

export const CLAUDE_EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export function validateModel(client: ClientName, model: string): string {
  if (client === "opencode" && !model.includes("/")) {
    throw new Error(`Modelo "${model}" inválido para o cliente opencode: use o formato provedor/modelo.`);
  }
  return model;
}

export function validateEffort(client: ClientName, effort: string): string {
  if (client === "opencode") {
    throw new Error(`O cliente opencode não aceita esforço, mas "${effort}" foi declarado.`);
  }
  if (client === "claude" && !(CLAUDE_EFFORTS as readonly string[]).includes(effort)) {
    throw new Error(`Esforço "${effort}" inválido para o cliente claude: use ${CLAUDE_EFFORTS.join(", ")}.`);
  }
  return effort;
}
