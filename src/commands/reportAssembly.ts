import fs from "node:fs";
import path from "node:path";
import { mergeBaseline } from "../evidence/baseline/index.js";
import { listPendingCases } from "../inputs/cases/index.js";
import {
  calibrationRecordPath,
  corpusFingerprint,
  isCalibrationStale,
  readCalibrationRecord,
} from "../measurement/calibration/index.js";
import { computeCoverage, discoverArtifacts } from "../inputs/discovery/index.js";
import type { Verdict } from "../domain/baseline.js";
import { caseKey } from "../domain/cases.js";
import type { RunRecord } from "../domain/results.js";
import {
  buildReportDocument,
  loadTestSuiteCard,
  renderTerminalSummary,
  writeReport,
  type ReportDocument,
} from "../evidence/reporting/index.js";
import { baselineForRun } from "./verdict/baselineLocation.js";
import type { ProjectContext } from "./projectContext.js";
import { judgeVerdict } from "./verdict/verdictContext.js";

function calibrationFor(context: ProjectContext) {
  const corpusPath = path.resolve(context.root, context.config.judge.calibrationPath);
  const record = readCalibrationRecord(calibrationRecordPath(corpusPath));
  if (!record) return undefined;
  const stale =
    !fs.existsSync(corpusPath) || isCalibrationStale(record, corpusFingerprint(fs.readFileSync(corpusPath, "utf8")));
  return { ...record, stale };
}

function verdictForRun(context: ProjectContext, run: RunRecord): Verdict {
  const profileBaseline = baselineForRun(context, run);
  if (run.invalid)
    return {
      passed: false,
      invalid: true,
      reasons: [{ code: "execucao-invalida", message: run.invalid.reason }],
      notices: [],
    };
  if (run.selection.partition) return judgeVerdict(context, profileBaseline, undefined);
  const suiteKeys = context.cases.map(caseKey);
  return judgeVerdict(
    context,
    mergeBaseline(profileBaseline, run, suiteKeys, new Date(run.finishedAt)),
    profileBaseline,
  );
}

export async function publishRunReport(context: ProjectContext, run: RunRecord): Promise<ReportDocument> {
  const reportPath = path.resolve(context.root, context.config.reportPath);
  const profileBaseline = baselineForRun(context, run);
  const document = buildReportDocument({
    config: context.config,
    run,
    profileBaseline,
    previousBaseline: profileBaseline,
    verdict: verdictForRun(context, run),
    coverage: computeCoverage(discoverArtifacts(context.config), context.cases),
    calibration: calibrationFor(context),
    testSuite: await loadTestSuiteCard(reportPath),
    pendingCaseKeys: listPendingCases(context.cases).map(caseKey),
  });
  await writeReport(document, reportPath);
  process.stdout.write(`${renderTerminalSummary(document)}\n`);
  return document;
}
