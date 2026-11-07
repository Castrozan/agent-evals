import type { CaseAssertions } from "../domain/cases.js";
import type { AssertionOutcome, SessionTranscript } from "../domain/results.js";

export type UsageAssertions = Pick<
  CaseAssertions,
  "skillsUsed" | "skillsForbidden" | "toolsUsed" | "toolsForbidden" | "commandsRun" | "commandsRunForbidden"
>;

export function shortToolName(toolName: string): string {
  if (!toolName.startsWith("mcp__")) return toolName;
  const separator = toolName.lastIndexOf("__");
  return separator > "mcp__".length - 1 ? toolName.slice(separator + 2) : toolName;
}

function listed(values: readonly string[], expected: string, normalize: (value: string) => string): boolean {
  const target = normalize(expected);
  return values.some((value) => normalize(value) === target);
}

function usageOutcomes(
  kind: string,
  label: string,
  expectations: readonly string[],
  actual: readonly string[],
  shouldBePresent: boolean,
  normalize: (value: string) => string,
): AssertionOutcome[] {
  return expectations.map((expected) => {
    const present = listed(actual, expected, normalize);
    const passed = present === shouldBePresent;
    const message = shouldBePresent
      ? passed
        ? `${label} "${expected}" usada.`
        : `${label} "${expected}" não foi usada. Usadas: ${actual.join(", ") || "nenhuma"}.`
      : passed
        ? `${label} "${expected}" não foi usada.`
        : `${label} "${expected}" foi usada e era proibida.`;
    return { kind, passed, message };
  });
}

function commandOutcomes(
  fragments: readonly string[],
  commandsRun: readonly string[],
  shouldBePresent: boolean,
): AssertionOutcome[] {
  return fragments.map((fragment) => {
    const matching = commandsRun.filter((command) => command.includes(fragment));
    const passed = matching.length > 0 === shouldBePresent;
    const message = shouldBePresent
      ? passed
        ? `Comando com "${fragment}" executado.`
        : `Nenhum comando executado contém "${fragment}".`
      : passed
        ? `Nenhum comando executado contém "${fragment}".`
        : `Comando proibido executado: ${matching[0]}`;
    return { kind: shouldBePresent ? "commandsRun" : "commandsRunForbidden", passed, message };
  });
}

export function evaluateSessionUsage(
  assertions: UsageAssertions,
  transcript: Pick<SessionTranscript, "skillsUsed" | "toolsUsed" | "commandsRun">,
): AssertionOutcome[] {
  const lower = (value: string) => value.toLowerCase();
  const { skillsUsed, toolsUsed } = transcript;
  return [
    ...usageOutcomes("skillsUsed", "Skill", assertions.skillsUsed, skillsUsed, true, lower),
    ...usageOutcomes("skillsForbidden", "Skill", assertions.skillsForbidden, skillsUsed, false, lower),
    ...usageOutcomes("toolsUsed", "Ferramenta", assertions.toolsUsed, toolsUsed, true, shortToolName),
    ...usageOutcomes("toolsForbidden", "Ferramenta", assertions.toolsForbidden, toolsUsed, false, shortToolName),
    ...commandOutcomes(assertions.commandsRun, transcript.commandsRun, true),
    ...commandOutcomes(assertions.commandsRunForbidden, transcript.commandsRun, false),
  ];
}
