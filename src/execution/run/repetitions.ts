import type { EvalCase } from "../../domain/cases.js";
import type { ProjectConfig } from "../../domain/project.js";

export function repetitionsFor(config: ProjectConfig, evalCase: EvalCase, multiplier: number): number {
  if (evalCase.type !== "instruction") return 1;
  const base = evalCase.repetitions ?? config.repetitionsByLevel[evalCase.level];
  return Math.max(1, Math.round(base * multiplier));
}
