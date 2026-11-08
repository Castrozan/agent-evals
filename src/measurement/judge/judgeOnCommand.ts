import { readFile } from "node:fs/promises";
import path from "node:path";
import { runShell } from "../assertions/shellCommand.js";
import type { JudgedCommand } from "../../domain/cases.js";
import type { AssertionOutcome, InstrumentFailure } from "../../domain/results.js";
import type { Grader } from "./grade.js";

export interface JudgeOnCommandContext {
  grader: Grader;
  sourceRoot: string;
  cwd: string;
  environment: Record<string, string>;
  timeoutMs: number;
}

export interface JudgeOnCommandResult {
  outcomes: AssertionOutcome[];
  instrumentFailure?: InstrumentFailure;
}

export async function judgeOnCommand(
  judged: JudgedCommand,
  context: JudgeOnCommandContext,
): Promise<JudgeOnCommandResult> {
  const result = await runShell({
    command: judged.run,
    cwd: context.cwd,
    environment: context.environment,
    timeoutMs: context.timeoutMs,
  });
  if (result.timedOut || result.exitCode !== 0) {
    const reason = result.timedOut ? "excedeu o tempo limite" : `saiu com código ${result.exitCode}`;
    return {
      outcomes: [{ kind: "judgeOnCommand", passed: false, message: `Comando "${judged.run}" ${reason}.` }],
    };
  }
  const reference =
    judged.reference === undefined
      ? undefined
      : await readFile(path.join(context.sourceRoot, judged.reference), "utf8");
  const response = [
    `Saída do comando \`${judged.run}\`:`,
    result.stdout,
    ...(reference === undefined ? [] : [`Referência (${judged.reference}):`, reference]),
  ].join("\n\n");
  const outcomes: AssertionOutcome[] = [];
  for (const criterion of judged.rubric) {
    const graded = await context.grader({ criterion, request: "", response });
    if (graded.instrumentFailure !== undefined) return { outcomes, instrumentFailure: graded.instrumentFailure };
    outcomes.push({
      kind: "judgeOnCommand",
      passed: graded.verdict === "pass",
      message: `Juiz sobre o comando "${judged.run}": ${verdictLabel(graded.verdict)} para "${criterion}".`,
    });
  }
  return { outcomes };
}

function verdictLabel(verdict: string): string {
  if (verdict === "pass") return "aprovado";
  return verdict === "fail" ? "reprovado" : "sem veredito";
}
