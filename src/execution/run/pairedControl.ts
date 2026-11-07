import type { CaseRunResult, SampleResult } from "../../domain/results.js";
import { exactMcNemar } from "../../statistics/significance.js";

export function comparePairedControl(
  withInstruction: readonly SampleResult[],
  withoutInstruction: readonly SampleResult[],
): CaseRunResult["pairedControl"] {
  const measuredWith = withInstruction.filter((sample) => sample.instrumentFailure === undefined);
  const measuredWithout = withoutInstruction.filter((sample) => sample.instrumentFailure === undefined);
  const pairs = Math.min(measuredWith.length, measuredWithout.length);
  let discordantDown = 0;
  let discordantUp = 0;
  for (let index = 0; index < pairs; index += 1) {
    const withPassed = measuredWith[index]!.passed;
    const withoutPassed = measuredWithout[index]!.passed;
    if (withPassed && !withoutPassed) discordantDown += 1;
    if (!withPassed && withoutPassed) discordantUp += 1;
  }
  return {
    withoutInstructionPasses: measuredWithout.filter((sample) => sample.passed).length,
    withoutInstructionSamples: measuredWithout.length,
    pValue: exactMcNemar(discordantDown, discordantUp).pValue,
  };
}
