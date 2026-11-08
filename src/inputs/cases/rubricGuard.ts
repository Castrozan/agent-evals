import { caseKey, type EvalCase } from "../../domain/cases.js";

export interface RubricViolation {
  category: string;
  name: string;
  sourceFile: string;
  message: string;
}

export function findRubricViolations(cases: EvalCase[]): RubricViolation[] {
  return cases.flatMap((evalCase) => {
    if (evalCase.type !== "instruction" || evalCase.pending || evalCase.level !== "unit") return [];
    const { judge, contains, notContains } = evalCase.assertions;
    if (judge.length > 0 || contains.length + notContains.length === 0) return [];
    return [
      {
        category: evalCase.category,
        name: evalCase.name,
        sourceFile: evalCase.sourceFile,
        message: `${evalCase.sourceFile}: ${caseKey(evalCase)}: caso de unidade sem rubrica 'juiz' usa apenas asserções de texto; escreva uma rubrica`,
      },
    ];
  });
}
