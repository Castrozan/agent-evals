import path from "node:path";
import type { Command } from "commander";
import {
  calibrationRecordPath,
  checkCalibrationGate,
  writeCalibrationRecord,
} from "../../measurement/calibration/index.js";
import { createGrader, readCalibrationCorpus, runCalibration } from "../../measurement/judge/index.js";
import { createSubjectClient } from "../../measurement/subjects/index.js";
import { loadProjectContext } from "../projectContext.js";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function registerCalibrateCommand(program: Command): void {
  program
    .command("calibrate")
    .description("mede a concordância do juiz com o corpo rotulado à mão e grava calibracao.json")
    .option("--execucoes <n>", "julga o corpo n vezes e grava a pior passada", "1")
    .action(async (options: { execucoes: string }) => {
      const { root, config } = loadProjectContext();
      const passes = Number(options.execucoes);
      if (!Number.isInteger(passes) || passes < 1) throw new Error(`--execucoes espera um inteiro positivo`);
      if (!config.judge.model) throw new Error("declare juiz.modelo no evals/config.yaml");
      const corpusPath = path.resolve(root, config.judge.calibrationPath);
      const judge = { client: config.judge.client, model: config.judge.model };
      const grader = createGrader({
        client: createSubjectClient(config.judge.client),
        model: config.judge.model,
        effort: config.judge.effort,
        timeoutMs: config.timeoutSeconds * 1000,
        removedEnvironment: config.subject.removedEnvironment,
      });
      const run = await runCalibration({ corpus: readCalibrationCorpus(corpusPath), grader, passes, judge });
      for (const [index, metrics] of run.passMetrics.entries()) {
        process.stdout.write(
          `passada ${index + 1}: acerto ${percent(metrics.accuracy)}, kappa ${metrics.kappa.toFixed(3)}, ` +
            `${run.excludedPerPass[index]} sem veredito\n`,
        );
      }
      if (run.flippedItems.length > 0) process.stdout.write(`vereditos que viraram: ${run.flippedItems.join(", ")}\n`);
      const recordPath = calibrationRecordPath(corpusPath);
      writeCalibrationRecord(recordPath, run.record);
      process.stdout.write(`gravado em ${path.relative(root, recordPath)}\n`);
      const gate = checkCalibrationGate(run.record);
      for (const failure of gate.failures) process.stdout.write(`${failure}\n`);
      if (!gate.passed) process.exitCode = 1;
    });
}
