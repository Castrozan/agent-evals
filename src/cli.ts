#!/usr/bin/env node
import { Command } from "commander";
import { registerBaselineCommand } from "./commands/verdict/baselineCommand.js";
import { registerCalibrateCommand } from "./commands/measurement/calibrateCommand.js";
import { registerCheckCommand } from "./commands/verdict/checkCommand.js";
import { registerCheckInstructionsCommand } from "./commands/checkInstructionsCommand.js";
import { registerCompareCommand } from "./commands/verdict/compareCommand.js";
import { translateEnglishFlags } from "./commands/flagAliases.js";
import { registerInitCommand } from "./commands/initCommand.js";
import { registerReportCommands } from "./commands/reportCommands.js";
import { addRunOptions, performRun, registerRunCommand } from "./commands/measurement/runCommand.js";

const program = new Command("agent-evals").description(
  "Suíte de regressão para instruções de agente, scripts, hooks e servidores MCP",
);

registerInitCommand(program);
registerRunCommand(program);
addRunOptions(
  registerBaselineCommand(program, {
    runAndRecord: async (context, options) => {
      const record = await performRun(context, options);
      if (!record) throw new Error("--rodar com --seco não grava baseline");
      return record;
    },
  }),
);
registerCheckCommand(program);
registerCheckInstructionsCommand(program);
registerReportCommands(program);
registerCompareCommand(program);
registerCalibrateCommand(program);

try {
  await program.parseAsync(translateEnglishFlags(process.argv));
} catch (error) {
  process.stderr.write(`agent-evals: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
