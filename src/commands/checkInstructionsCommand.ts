import path from "node:path";
import type { Command } from "commander";
import { findRepositoryRoot, loadProjectConfig } from "../configuration/index.js";
import { discoverArtifacts } from "../discovery/index.js";
import { checkInstructions, formatInstructionFailure } from "../instructions/index.js";

export function registerCheckInstructionsCommand(program: Command): void {
  program
    .command("check-instructions")
    .description("verifica autoria e links das instruções descobertas, sem casos, baseline ou modelo")
    .action(() => {
      const config = loadProjectConfig(findRepositoryRoot(process.cwd()));
      const failures = checkInstructions(config);
      for (const failure of failures) process.stdout.write(`${formatInstructionFailure(failure)}\n`);
      if (failures.length > 0) {
        process.exitCode = 1;
        return;
      }
      const checked = discoverArtifacts(config).filter((artifact) => artifact.kind === "instruction");
      for (const artifact of checked) process.stdout.write(`ok ${path.normalize(artifact.path)}\n`);
      process.stdout.write(`${checked.length} instruções verificadas\n`);
    });
}
