import type { Partition } from "../configuration/enumAliases.js";
import type { EvalCase } from "../domain/cases.js";

export interface CaseSelection {
  categories?: string[];
  caseNames?: string[];
  partition?: Partition;
}

export function selectCases(cases: EvalCase[], selection: CaseSelection = {}): EvalCase[] {
  const { categories = [], caseNames = [], partition } = selection;
  return cases.filter((evalCase) => {
    if (evalCase.pending) return false;
    if (categories.length > 0 && !categories.includes(evalCase.category)) return false;
    if (caseNames.length > 0 && !caseNames.some((part) => evalCase.name.includes(part))) {
      return false;
    }
    if (partition === "train" && evalCase.heldOut) return false;
    if (partition === "held-out" && !evalCase.heldOut) return false;
    return true;
  });
}

export function listPendingCases(cases: EvalCase[]): EvalCase[] {
  return cases.filter((evalCase) => evalCase.pending);
}
