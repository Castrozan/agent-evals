import type { Verdict, VerdictReason } from "../../domain/baseline.js";
import { caseKey } from "../../domain/cases.js";
import { changedInstructionReasons, coverageReasons, expiredEvidenceReasons, profileReasons } from "./evidenceGates.js";
import { evaluateRateGates } from "./rateGates.js";
import { describeRegression, findRegression, incompatibleInstruments } from "./regression.js";
import type { VerdictInput } from "./types.js";

export function evaluateVerdict(input: VerdictInput): Verdict {
  const { config, suiteCases, baseline, previousBaseline, now } = input;
  if (baseline === undefined) {
    return {
      passed: false,
      invalid: false,
      reasons: [{ code: "baseline-ausente", message: "Nenhuma baseline encontrada: rode a suíte e grave a baseline." }],
      notices: [],
    };
  }
  const activeKeys = new Set(suiteCases.filter((evalCase) => !evalCase.pending).map(caseKey));
  const measuredInSuite = Object.fromEntries(Object.entries(baseline.cases).filter(([key]) => activeKeys.has(key)));
  const rateGates = evaluateRateGates(measuredInSuite, config.thresholds);
  const reasons: VerdictReason[] = [...rateGates.reasons];
  const notices = [...rateGates.notices];
  let regression: Verdict["regression"];
  if (previousBaseline !== undefined) {
    const incompatibility = incompatibleInstruments(baseline, previousBaseline);
    if (incompatibility === undefined) {
      regression = findRegression({ ...baseline, cases: measuredInSuite }, previousBaseline, config.thresholds.maxDrop);
      if (regression?.significant) {
        reasons.push({ code: "regressao", message: describeRegression(regression, config.thresholds.maxDrop) });
      }
    } else {
      notices.push(`Regressão não avaliada: ${incompatibility}.`);
    }
  }
  reasons.push(
    ...changedInstructionReasons(baseline, input.instructionFingerprintsNow, suiteCases),
    ...expiredEvidenceReasons(baseline, config.thresholds, now),
    ...profileReasons(baseline, input.canonicalProfileId),
    ...coverageReasons(baseline, suiteCases, config.thresholds),
    ...input.rubricViolations.map((violation) => ({
      code: "rubrica",
      caseKey: violation.caseKey,
      message: `Caso ${violation.caseKey}: ${violation.message}`,
    })),
    ...input.instructionFormatFailures.map((failure) => ({
      code: "formato-instrucoes",
      file: failure.file,
      message: `${failure.file}:${failure.line}: ${failure.rule}: ${failure.message}`,
    })),
  );
  return {
    passed: reasons.length === 0,
    invalid: false,
    reasons,
    notices,
    ...(regression === undefined ? {} : { regression }),
  };
}
