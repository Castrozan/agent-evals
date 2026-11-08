import { findRubricViolations } from "../../inputs/cases/index.js";
import type { Baseline } from "../../domain/baseline.js";
import { caseKey } from "../../domain/cases.js";
import { instructionFingerprints } from "../../inputs/fingerprint/index.js";
import { checkInstructions } from "../../inputs/instructions/index.js";
import { buildExecutionProfile, profileId } from "../../measurement/profile/index.js";
import { evaluateVerdict } from "../../evidence/verdict/index.js";
import type { Verdict } from "../../domain/baseline.js";
import type { ProjectContext } from "../projectContext.js";

export function canonicalProfileId(context: ProjectContext): string {
  return profileId(buildExecutionProfile(context.config, context.config.subject.canonicalClient));
}

export function judgeVerdict(
  context: ProjectContext,
  baseline: Baseline | undefined,
  previousBaseline: Baseline | undefined,
  now = new Date(),
): Verdict {
  const { config, cases, root } = context;
  return evaluateVerdict({
    config,
    suiteCases: cases,
    baseline,
    previousBaseline,
    canonicalProfileId: canonicalProfileId(context),
    instructionFingerprintsNow: instructionFingerprints(cases, root),
    now,
    rubricViolations: findRubricViolations(cases).map((violation) => ({
      caseKey: caseKey(violation),
      message: violation.message,
    })),
    instructionFormatFailures: config.validateInstructionFormat ? checkInstructions(config) : [],
  });
}
