import type { CaseAssertions } from "../domain/cases.js";
import type { AssertionOutcome } from "../domain/results.js";

export type TextAssertions = Pick<CaseAssertions, "equals" | "contains" | "notContains" | "regex" | "notRegex">;

function outcome(kind: string, passed: boolean, message: string): AssertionOutcome {
  return { kind, passed, message };
}

function matchesPattern(pattern: string, output: string): boolean | undefined {
  try {
    return new RegExp(pattern, "m").test(output);
  } catch {
    return undefined;
  }
}

function patternOutcome(kind: "regex" | "notRegex", pattern: string, output: string): AssertionOutcome {
  const matched = matchesPattern(pattern, output);
  if (matched === undefined) return outcome(kind, false, `Expressão regular inválida: ${pattern}`);
  if (kind === "regex") {
    return outcome(kind, matched, matched ? `Casou com /${pattern}/.` : `Não casou com /${pattern}/.`);
  }
  return outcome(kind, !matched, matched ? `Casou com /${pattern}/ e não devia.` : `Não casou com /${pattern}/.`);
}

export function evaluateTextAssertions(assertions: TextAssertions, output: string): AssertionOutcome[] {
  const normalized = output.toLowerCase();
  const results: AssertionOutcome[] = [];
  if (assertions.equals.length > 0) {
    const trimmed = output.trim().toLowerCase();
    const matched = assertions.equals.some((expected) => expected.trim().toLowerCase() === trimmed);
    results.push(
      outcome(
        "equals",
        matched,
        matched
          ? "A saída é igual a uma das opções."
          : `A saída não é igual a nenhuma das opções: ${assertions.equals.join(" | ")}`,
      ),
    );
  }
  for (const text of assertions.contains) {
    const found = normalized.includes(text.toLowerCase());
    results.push(outcome("contains", found, found ? `Contém "${text}".` : `Não contém "${text}".`));
  }
  for (const text of assertions.notContains) {
    const found = normalized.includes(text.toLowerCase());
    results.push(outcome("notContains", !found, found ? `Contém "${text}" e não devia.` : `Não contém "${text}".`));
  }
  for (const pattern of assertions.regex) results.push(patternOutcome("regex", pattern, output));
  for (const pattern of assertions.notRegex) results.push(patternOutcome("notRegex", pattern, output));
  return results;
}
