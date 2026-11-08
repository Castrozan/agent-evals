import type { Command } from "commander";
import { findRepositoryRoot } from "../inputs/configuration/index.js";
import { initializeProject } from "../inputs/init/index.js";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("varre o repositório, semeia evals/ e liga a esteira; pode rodar de novo sem sobrescrever nada")
    .action(async () => {
      const summary = await initializeProject(findRepositoryRoot(process.cwd()));
      for (const created of summary.created) process.stdout.write(`criado ${created}\n`);
      for (const skipped of summary.skipped) process.stdout.write(`mantido ${skipped.path}: ${skipped.reason}\n`);
    });
}
