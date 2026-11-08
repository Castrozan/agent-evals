import path from "node:path";
import type { Command } from "commander";
import { previousCommittedBaseline, readBaseline } from "../../evidence/baseline/index.js";
import { judgeRecordedEvidenceOnly, renderVerdict } from "../../evidence/verdict/index.js";
import { loadProjectContext } from "../projectContext.js";
import { judgeVerdict } from "./verdictContext.js";

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("dá o veredito sobre a baseline gravada, sem chamar modelo; é o que a esteira roda")
    .option("--gravado", "julga só a evidência gravada: medição vencida ou ausente vira aviso")
    .action((options: { gravado?: boolean }) => {
      const context = loadProjectContext();
      const baselinePath = context.config.baselinePath;
      const fullVerdict = judgeVerdict(
        context,
        readBaseline(path.resolve(context.root, baselinePath)),
        previousCommittedBaseline(context.root, baselinePath),
      );
      const verdict = options.gravado ? judgeRecordedEvidenceOnly(fullVerdict) : fullVerdict;
      process.stdout.write(`${renderVerdict(verdict)}\n`);
      if (!verdict.passed) process.exitCode = 1;
    });
}
