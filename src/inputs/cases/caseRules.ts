import type { EvalCase } from "../../domain/cases.js";

const GLOB_CHARACTERS = /[*?[\]{}]/;

export function findKindRuleViolation(evalCase: EvalCase): string | undefined {
  const plugins = evalCase.type === "mcp" ? [] : (evalCase.environment?.plugins ?? []);
  if (evalCase.environmentKind === "skill") {
    if (plugins.length > 0) {
      return "casos de skill não podem declarar plugin ou plugins";
    }
    if (evalCase.type === "instruction") {
      const target = evalCase.instruction ?? "";
      const isSkillFile = target.split("/").pop() === "SKILL.md";
      if (!isSkillFile || GLOB_CHARACTERS.test(target)) {
        return "casos de skill devem apontar 'instrucao' para um SKILL.md sem glob";
      }
    }
  }
  if (
    evalCase.environmentKind === "package" &&
    evalCase.type === "instruction" &&
    evalCase.level !== "unit" &&
    plugins.length === 0
  ) {
    return "casos de integração e ponta-a-ponta de pacote devem declarar plugin ou plugins";
  }
  return undefined;
}
