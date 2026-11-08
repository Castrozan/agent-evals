import type { CommandCheck } from "../../domain/cases.js";
import type { AssertionOutcome } from "../../domain/results.js";
import { runShell } from "./shellCommand.js";

export interface CommandContext {
  cwd: string;
  environment: Record<string, string>;
  timeoutMs: number;
}

const OUTPUT_EXCERPT_LIMIT = 2000;

function excerpt(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > OUTPUT_EXCERPT_LIMIT ? `${trimmed.slice(0, OUTPUT_EXCERPT_LIMIT)}…` : trimmed;
}

function lineMatches(pattern: string, output: string): boolean {
  const expression = new RegExp(pattern);
  return output.split("\n").some((line) => expression.test(line));
}

export async function evaluateCommandChecks(
  checks: readonly CommandCheck[],
  context: CommandContext,
): Promise<AssertionOutcome[]> {
  const outcomes: AssertionOutcome[] = [];
  for (const check of checks) {
    const result = await runShell({ command: check.run, ...context });
    const output = `${result.stdout}${result.stderr}`;
    if (result.timedOut || result.exitCode !== 0) {
      const reason = result.timedOut ? "excedeu o tempo limite" : `saiu com código ${result.exitCode}`;
      outcomes.push({
        kind: "command",
        passed: false,
        message: `Comando "${check.run}" ${reason}: ${excerpt(output)}`,
      });
      continue;
    }
    const hasPattern = check.regex !== undefined || check.notRegex !== undefined;
    if (!hasPattern)
      outcomes.push({ kind: "command", passed: true, message: `Comando "${check.run}" saiu com código 0.` });
    if (check.regex !== undefined) {
      const matched = lineMatches(check.regex, result.stdout);
      outcomes.push({
        kind: "command",
        passed: matched,
        message: `Comando "${check.run}": ${matched ? "casou" : "nenhuma linha casou"} com /${check.regex}/.`,
      });
    }
    if (check.notRegex !== undefined) {
      const matched = lineMatches(check.notRegex, result.stdout);
      outcomes.push({
        kind: "command",
        passed: !matched,
        message: `Comando "${check.run}": ${matched ? "uma linha casou com" : "nenhuma linha casou com"} /${check.notRegex}/.`,
      });
    }
  }
  return outcomes;
}
