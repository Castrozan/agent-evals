import type { ClientName } from "../../domain/clients.js";
import type { StagingRequest } from "../../domain/ports.js";
import { StagingError } from "./stagingError.js";

export function substituteSession(value: string, sessionDirectory: string): string {
  return value.replaceAll("{sessao}", sessionDirectory);
}

export function rejectUnsupportedOpencodeInputs(client: ClientName, request: StagingRequest): void {
  if (client !== "opencode") return;
  if (
    Object.keys(request.config.subject.environment).length > 0 ||
    Object.keys(request.variantEnvironment).length > 0
  ) {
    throw new StagingError("O cliente opencode não aceita ambiente do sujeito: remova sujeito.ambiente ou a variante.");
  }
}

export function subjectEnvironment(request: StagingRequest, sessionDirectory: string): Record<string, string> {
  const merged = { ...request.config.subject.environment, ...request.variantEnvironment };
  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [key, substituteSession(value, sessionDirectory)]),
  );
}
