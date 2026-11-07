import type { SubjectInvocation } from "../domain/ports.js";

const OPERATOR_SESSION_MARKERS = ["CLAUDECODE"];

export function inheritedEnvironment(
  invocation: Pick<SubjectInvocation, "environment" | "removedEnvironment">,
): Record<string, string> {
  const removed = new Set([...OPERATOR_SESSION_MARKERS, ...invocation.removedEnvironment]);
  const inherited = Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !removed.has(entry[0]),
  );
  return { ...Object.fromEntries(inherited), ...invocation.environment };
}
