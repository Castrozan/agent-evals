import type { InstrumentFailure } from "../../domain/results.js";

export interface FailureSignals {
  timedOut: boolean;
  timeoutMs: number;
  message: string;
}

const SESSION_LIMIT_PATTERN =
  /usage limit|session limit|hit your limit|rate.?limit|quota|limit reached|too many requests|\b429\b/i;
const CREDENTIAL_PATTERN =
  /unauthori[sz]ed|authenticat|credential|invalid api key|api key|not logged in|log ?in|login|token (has )?expired|expired token|\b401\b|\b403\b/i;
const KILLED_PATTERN = /killed|SIGKILL|SIGTERM|SIGINT|aborted|terminated by signal|exited with code (137|143)/i;

export function describeError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const detail = record.detail ?? record.message ?? record.title;
    if (detail) return String(detail);
    return JSON.stringify(error);
  }
  return String(error);
}

export function classifyFailure({ timedOut, timeoutMs, message }: FailureSignals): InstrumentFailure {
  if (timedOut) return { kind: "timeout", message: `Tempo limite de ${Math.round(timeoutMs / 1000)}s excedido.` };
  if (SESSION_LIMIT_PATTERN.test(message)) return { kind: "session-limit", message };
  if (CREDENTIAL_PATTERN.test(message)) return { kind: "credential", message };
  if (KILLED_PATTERN.test(message)) return { kind: "killed", message };
  return { kind: "client-error", message };
}
