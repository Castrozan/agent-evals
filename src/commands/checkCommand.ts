import path from "node:path";
import type { Command } from "commander";
import { previousCommittedBaseline, readBaseline } from "../baseline/index.js";
import { renderVerdict } from "../verdict/index.js";
import { loadProjectContext } from "./projectContext.js";
import { judgeVerdict } from "./verdictContext.js";

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("dá o veredito sobre a baseline gravada, sem chamar modelo; é o que a esteira roda")
    .action(() => {
      const context = loadProjectContext();
      const baselinePath = context.config.baselinePath;
      const verdict = judgeVerdict(
        context,
        readBaseline(path.resolve(context.root, baselinePath)),
        previousCommittedBaseline(context.root, baselinePath),
      );
      process.stdout.write(`${renderVerdict(verdict)}\n`);
      if (!verdict.passed) process.exitCode = 1;
    });
}
