import type { Baseline } from "../../domain/baseline.js";

const MILLISECONDS_PER_DAY = 86_400_000;

export interface FingerprintedCase {
  caseKey: string;
  fingerprint: string;
}

export function selectAffectedCases<Candidate extends FingerprintedCase>(
  cases: readonly Candidate[],
  baseline: Baseline | undefined,
  now: Date,
  validityDays: number,
): Candidate[] {
  return cases.filter((candidate) => {
    const recorded = baseline?.cases[candidate.caseKey];
    if (recorded === undefined) return true;
    if (recorded.fingerprint !== candidate.fingerprint) return true;
    const ageDays = (now.getTime() - new Date(recorded.measuredAt).getTime()) / MILLISECONDS_PER_DAY;
    return !(ageDays <= validityDays);
  });
}
