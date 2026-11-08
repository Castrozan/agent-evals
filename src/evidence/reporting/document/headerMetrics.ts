import { groupBy } from "./groupBy.js";
import { passAtK, headroomExceedsNoise, noiseFloor, wilsonInterval } from "../../statistics/proportions.js";
import type { CaseLevel } from "../../../domain/cases.js";
import type {
  CalibrationInput,
  LevelTotals,
  ReportCalibration,
  ReportCase,
  ReportNoise,
  ReportRate,
} from "./reportDocument.js";

const LEVEL_ORDER: CaseLevel[] = ["unit", "integration", "end-to-end"];
const PASS_AT_K_VALUES = [1, 3];

export function overallRate(cases: ReportCase[]): ReportRate | null {
  const samples = cases.reduce((sum, reportCase) => sum + reportCase.samples, 0);
  if (samples === 0) return null;
  const passes = cases.reduce((sum, reportCase) => sum + reportCase.passes, 0);
  const estimate = wilsonInterval(passes, samples);
  return { value: estimate.rate, lower: estimate.lower, upper: estimate.upper, passes, samples };
}

export function noiseAgainstHeadroom(cases: ReportCase[], rate: ReportRate | null): ReportNoise | null {
  const measured = cases.filter((reportCase) => reportCase.samples > 0);
  if (!rate || measured.length === 0) return null;
  const repetitions = rate.samples / measured.length;
  return {
    floor: noiseFloor(measured.length, repetitions),
    headroom: 1 - rate.value,
    headroomExceedsNoise: headroomExceedsNoise(rate.value, measured.length, repetitions),
  };
}

export function passAtKSummary(cases: ReportCase[]) {
  return PASS_AT_K_VALUES.flatMap((k) => {
    const eligible = cases.filter((reportCase) => reportCase.samples >= k);
    if (eligible.length === 0) return [];
    const total = eligible.reduce((sum, reportCase) => sum + passAtK(reportCase.samples, reportCase.passes, k), 0);
    return [{ k, value: total / eligible.length, cases: eligible.length }];
  });
}

export function totalsPerLevel(cases: ReportCase[]): LevelTotals[] {
  const byLevel = groupBy(
    cases.filter((reportCase) => !reportCase.inherited),
    (reportCase) => reportCase.level,
  );
  return LEVEL_ORDER.flatMap((level) => {
    const levelCases = byLevel.get(level);
    if (!levelCases) return [];
    return [
      {
        level,
        cases: levelCases.length,
        samples: levelCases.reduce((sum, reportCase) => sum + reportCase.samples, 0),
        costUsd: levelCases.reduce((sum, reportCase) => sum + reportCase.costUsd, 0),
        durationSeconds: levelCases.reduce((sum, reportCase) => sum + reportCase.durationSeconds, 0),
      },
    ];
  });
}

export function calibrationState(calibration: CalibrationInput | undefined): ReportCalibration {
  if (!calibration) return { status: "never" };
  return {
    status: calibration.stale ? "stale" : "current",
    kappa: calibration.kappa,
    accuracy: calibration.accuracy,
    recordedAt: calibration.recordedAt,
  };
}
