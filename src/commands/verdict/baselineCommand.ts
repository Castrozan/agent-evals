import path from "node:path";
import type { Command } from "commander";
import { mergeBaseline, writeBaseline } from "../../evidence/baseline/index.js";
import { caseKey } from "../../domain/cases.js";
import type { RunRecord } from "../../domain/results.js";
import { baselineForRun, baselinePathForRun } from "./baselineLocation.js";
import { readLastRun } from "../lastRun.js";
import { loadProjectContext, type ProjectContext } from "../projectContext.js";

export function recordBaseline(context: ProjectContext, run: RunRecord): string {
  const target = baselinePathForRun(context, run);
  const merged = mergeBaseline(baselineForRun(context, run), run, context.cases.map(caseKey), new Date(run.finishedAt));
  writeBaseline(target, merged);
  return path.relative(context.root, target);
}

export interface BaselineCommandHooks {
  runAndRecord?: (context: ProjectContext, options: Record<string, unknown>) => Promise<RunRecord>;
}

export function registerBaselineCommand(program: Command, hooks: BaselineCommandHooks = {}): Command {
  return program
    .command("baseline")
    .description("grava como baseline a última execução conferida; --rodar mede e grava em um passo")
    .option("--rodar", "roda a suíte antes de gravar")
    .action(async (options: Record<string, unknown>) => {
      const context = loadProjectContext();
      const run =
        options.rodar && hooks.runAndRecord ? await hooks.runAndRecord(context, options) : readLastRun(context.config);
      if (typeof options.variante === "string" && run.variant !== options.variante) {
        throw new Error(
          `a última execução não é da variante ${options.variante}; rode com --variante ${options.variante}`,
        );
      }
      process.stdout.write(`baseline gravada em ${recordBaseline(context, run)}\n`);
    });
}
