import type { CalibrationRecord } from "../domain/artifacts.js";
import { verdictFlips } from "../calibration/gate.js";
import { agreementMetrics, type AgreementMetrics } from "../statistics/agreement.js";
import type { CalibrationCorpus } from "./corpus.js";
import type { Grader } from "./grade.js";

export interface CalibrationRunOptions {
  corpus: CalibrationCorpus;
  grader: Grader;
  passes: number;
  judge: CalibrationRecord["judge"];
  now?: Date;
}

export interface CalibrationRun {
  record: CalibrationRecord;
  passMetrics: AgreementMetrics[];
  flippedItems: string[];
  excludedPerPass: number[];
}

export async function runCalibration(options: CalibrationRunOptions): Promise<CalibrationRun> {
  const { corpus, grader } = options;
  const verdictsByItem: boolean[][] = corpus.items.map(() => []);
  const passMetrics: AgreementMetrics[] = [];
  const excludedPerPass: number[] = [];
  for (let pass = 0; pass < options.passes; pass += 1) {
    const labelled: { expected: boolean; actual: boolean }[] = [];
    let excluded = 0;
    for (const [position, item] of corpus.items.entries()) {
      const graded = await grader({ criterion: item.rubric, request: item.request, response: item.output });
      if (graded.verdict === "no-verdict") {
        excluded += 1;
        continue;
      }
      const actual = graded.verdict === "pass";
      verdictsByItem[position]!.push(actual);
      labelled.push({ expected: item.expectedPass, actual });
    }
    passMetrics.push(agreementMetrics(labelled));
    excludedPerPass.push(excluded);
  }
  const worst = passMetrics.reduce((lowest, current) => (current.kappa < lowest.kappa ? current : lowest));
  return {
    record: {
      corpusFingerprint: corpus.fingerprint,
      judge: options.judge,
      items: worst.items,
      accuracy: worst.accuracy,
      balancedAccuracy: worst.balancedAccuracy,
      recall: worst.recall,
      kappa: worst.kappa,
      passes: options.passes,
      recordedAt: (options.now ?? new Date()).toISOString(),
    },
    passMetrics,
    flippedItems: verdictFlips(verdictsByItem).map((position) => corpus.items[position]!.name),
    excludedPerPass,
  };
}
