import type { EvalCase } from "../../../domain/cases.js";
import type { ExecutionProfile } from "../../../domain/clients.js";
import type { ProjectConfig } from "../../../domain/project.js";
import { repetitionsFor } from "./repetitions.js";

export interface PlannedCase {
  caseKey: string;
  level: EvalCase["level"];
  type: EvalCase["type"];
  repetitions: number;
}

export interface RunPlan {
  profile: ExecutionProfile;
  cases: PlannedCase[];
}

export function planRun(
  config: ProjectConfig,
  cases: readonly EvalCase[],
  profile: ExecutionProfile,
  multiplier: number,
): RunPlan {
  return {
    profile,
    cases: cases.map((evalCase) => ({
      caseKey: `${evalCase.category}/${evalCase.name}`,
      level: evalCase.level,
      type: evalCase.type,
      repetitions: repetitionsFor(config, evalCase, multiplier),
    })),
  };
}

export function renderPlan(plan: RunPlan): string {
  const { subject, judge } = plan.profile;
  const header = `Plano: sujeito ${subject.client}/${subject.model}${subject.effort ? `/${subject.effort}` : ""}, juiz ${judge.client}${judge.model ? `/${judge.model}` : ""}.`;
  const lines = plan.cases.map(
    (planned) => `- ${planned.caseKey} (${planned.level}, ${planned.type}): ${planned.repetitions} execução(ões)`,
  );
  return [header, ...lines].join("\n");
}
