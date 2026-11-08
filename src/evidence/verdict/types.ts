import type { Baseline, VerdictReason } from "../../domain/baseline.js";
import type { EvalCase } from "../../domain/cases.js";
import type { InstructionFormatFailure } from "../../domain/artifacts.js";
import type { ProjectConfig } from "../../domain/project.js";

export interface RubricViolation {
  caseKey: string;
  message: string;
}

export interface VerdictInput {
  config: ProjectConfig;
  suiteCases: readonly EvalCase[];
  baseline: Baseline | undefined;
  previousBaseline: Baseline | undefined;
  canonicalProfileId: string;
  instructionFingerprintsNow: Record<string, string>;
  now: Date;
  rubricViolations: readonly RubricViolation[];
  instructionFormatFailures: readonly InstructionFormatFailure[];
}

export interface GateOutcome {
  reasons: VerdictReason[];
  notices: string[];
}
