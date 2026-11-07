#!/usr/bin/env node
import { Command } from "commander";

const program = new Command("agent-evals").description(
  "Suíte de regressão para instruções de agente, scripts, hooks e servidores MCP",
);

await program.parseAsync(process.argv);
