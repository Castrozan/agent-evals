export const CLIENT_NAMES = ["claude", "codex", "opencode"] as const;

export type ClientName = (typeof CLIENT_NAMES)[number];

export interface ClientScopedValue {
  scalar?: string;
  byClient: Partial<Record<ClientName, string>>;
}

export interface ExecutionProfile {
  subject: { client: ClientName; model: string; effort?: string };
  judge: { client: ClientName; model?: string; effort?: string };
}

export function isClientName(value: string): value is ClientName {
  return (CLIENT_NAMES as readonly string[]).includes(value);
}
