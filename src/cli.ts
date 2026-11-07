#!/usr/bin/env node
import { Command } from "commander";
import { registerBaselineCommand } from "./commands/baselineCommand.js";
import { registerCheckCommand } from "./commands/checkCommand.js";
import { registerCheckInstructionsCommand } from "./commands/checkInstructionsCommand.js";
import { registerCompareCommand } from "./commands/compareCommand.js";
import { translateEnglishFlags } from "./commands/flagAliases.js";
import { registerInitCommand } from "./commands/initCommand.js";
import { registerReportCommands } from "./commands/reportCommands.js";

const program = new Command("agent-evals").description(
  "Suíte de regressão para instruções de agente, scripts, hooks e servidores MCP",
);

registerInitCommand(program);
registerBaselineCommand(program);
registerCheckCommand(program);
registerCheckInstructionsCommand(program);
registerReportCommands(program);
registerCompareCommand(program);

try {
  await program.parseAsync(translateEnglishFlags(process.argv));
} catch (error) {
  process.stderr.write(`agent-evals: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
