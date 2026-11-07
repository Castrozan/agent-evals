import type { Baseline } from "../../domain/baseline.js";
import type { CaseRunResult } from "../../domain/results.js";
import { measuredSamples } from "../../domain/results.js";
import type { ReportCase, ReportFailure, ReportFlaky } from "./reportDocument.js";

function failureDetails(result: CaseRunResult | undefined) {
  if (!result) return { expected: [], failedAssertions: [] };
  const failingSample = measuredSamples(result).find((sample) => !sample.passed);
  return {
    input: result.prompt,
    expected: result.expected ?? [],
    actualOutput: failingSample?.output,
    failedAssertions: (failingSample?.assertions ?? [])
      .filter((assertion) => !assertion.passed)
      .map((assertion) => assertion.message),
  };
}

function failingSince(reportCase: ReportCase, previousBaseline?: Baseline): string | undefined {
  if (reportCase.inherited) return reportCase.measuredAt;
  const previous = previousBaseline?.cases[reportCase.key];
  if (!previous || previous.samples === 0 || previous.passes / previous.samples >= 0.5) return undefined;
  return previous.measuredAt;
}

export function collectFailures(
  cases: ReportCase[],
  results: CaseRunResult[],
  previousBaseline?: Baseline,
): ReportFailure[] {
  const resultsByKey = new Map(results.map((result) => [result.caseKey, result]));
  return cases
    .filter((reportCase) => reportCase.status === "failed")
    .map((reportCase) => ({
      key: reportCase.key,
      category: reportCase.category,
      name: reportCase.name,
      level: reportCase.level,
      heldOut: reportCase.heldOut,
      inherited: reportCase.inherited,
      passes: reportCase.passes,
      samples: reportCase.samples,
      ...failureDetails(resultsByKey.get(reportCase.key)),
      failingSince: failingSince(reportCase, previousBaseline),
    }))
    .sort((first, second) => first.key.localeCompare(second.key));
}

export function collectFlaky(cases: ReportCase[]): ReportFlaky[] {
  return cases
    .filter((reportCase) => reportCase.flaky)
    .map((reportCase) => ({
      key: reportCase.key,
      heldOut: reportCase.heldOut,
      inherited: reportCase.inherited,
      passes: reportCase.passes,
      samples: reportCase.samples,
    }))
    .sort((first, second) => first.key.localeCompare(second.key));
}
