import type { Baseline, Verdict } from "../../domain/baseline.js";
import type { CoverageEntry, TestSuiteCard } from "../../domain/artifacts.js";
import type { ProjectConfig } from "../../domain/project.js";
import type { RunRecord } from "../../domain/results.js";
import { collectFailures, collectFlaky } from "./failures.js";
import { groupByCategory, summarizeCoverage } from "./grouping.js";
import {
  calibrationState,
  noiseAgainstHeadroom,
  overallRate,
  passAtKSummary,
  totalsPerLevel,
} from "./headerMetrics.js";
import { aggregateRate, mergeSuite } from "./mergeSuite.js";
import {
  REPORT_SCHEMA_VERSION,
  type CalibrationInput,
  type ReportDocument,
  type VerdictStatus,
} from "./reportDocument.js";

export interface ReportDocumentInput {
  config: ProjectConfig;
  run: RunRecord;
  profileBaseline?: Baseline;
  previousBaseline?: Baseline;
  verdict: Verdict;
  coverage: CoverageEntry[];
  calibration?: CalibrationInput;
  testSuite?: TestSuiteCard;
  pendingCaseKeys: string[];
}

function verdictStatus(invalid: boolean, passed: boolean): VerdictStatus {
  if (invalid) return "invalid";
  return passed ? "approved" : "failed";
}

export function buildReportDocument(input: ReportDocumentInput): ReportDocument {
  const { run, verdict } = input;
  const invalid = Boolean(run.invalid) || verdict.invalid;
  const cases = mergeSuite(run.cases, run.finishedAt, run.selection.partial, input.profileBaseline);
  const rate = invalid ? null : overallRate(cases);
  const coverage = summarizeCoverage(input.coverage, input.pendingCaseKeys);
  const inheritedCases = cases.filter((reportCase) => reportCase.inherited).length;
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    header: {
      project: run.project || input.config.project,
      generatedAt: run.finishedAt,
      commit: run.commit,
      revision: run.revision,
      variant: run.variant,
      profile: run.profile,
      status: verdictStatus(invalid, verdict.passed),
      invalidReason: run.invalid?.reason,
      rate,
      previousRate: invalid ? null : aggregateRate(input.previousBaseline),
      passAtK: invalid ? [] : passAtKSummary(cases),
      noise: noiseAgainstHeadroom(cases, rate),
      measured: {
        partial: run.selection.partial,
        measuredCases: cases.length - inheritedCases,
        inheritedCases,
        totalCases: cases.length,
        categories: run.selection.categories,
        caseFilters: run.selection.cases,
        affected: run.selection.affected,
        partition: run.selection.partition,
      },
      levels: totalsPerLevel(cases),
      coverage: coverage.byKind,
      pendingCases: input.pendingCaseKeys.length,
      instrument: run.instrument,
      calibration: calibrationState(input.calibration),
      isolation: { isolated: run.leakedSkills.length === 0, leakedSkills: run.leakedSkills },
      reasons: invalid ? [] : verdict.reasons,
      notices: verdict.notices,
      regression: invalid ? undefined : verdict.regression,
      testSuite: input.testSuite,
    },
    categories: groupByCategory(cases, input.coverage),
    failures: collectFailures(cases, run.cases, input.previousBaseline),
    flaky: collectFlaky(cases),
    uncovered: coverage.uncovered,
  };
}
