import { evaluateGeneratedFiles } from "../assertions/generatedFiles.js";
import { runShell } from "../assertions/shellCommand.js";
import { evaluateTextAssertions } from "../assertions/text.js";
import type { CliCase } from "../domain/cases.js";
import { caseKey } from "../domain/cases.js";
import type { AssertionOutcome, SampleResult } from "../domain/results.js";
import { EMPTY_TOKEN_USAGE, substituteSessionInAll, type SampleRuntime } from "./sampleRuntime.js";

type CliRuntime = Pick<
  SampleRuntime,
  "config" | "profile" | "sourceRoot" | "stager" | "variantPlugins" | "variantEnvironment"
>;

async function runInDirectory(
  evalCase: CliCase,
  directory: string,
  environment: Record<string, string>,
  timeoutMs: number,
): Promise<{ assertions: AssertionOutcome[]; output: string }> {
  const result = await runShell({
    command: evalCase.command,
    cwd: directory,
    environment,
    stdin: evalCase.stdin,
    timeoutMs,
  });
  const output = result.stdout;
  if (result.timedOut) {
    return {
      assertions: [{ kind: "timeout", passed: false, message: `Excedeu o tempo limite de ${timeoutMs / 1000}s.` }],
      output,
    };
  }
  const exitPassed = result.exitCode === evalCase.exitCode;
  const exitMessage = exitPassed
    ? `Código de saída ${result.exitCode}.`
    : `Código de saída ${result.exitCode}, esperado ${evalCase.exitCode}. ${result.stderr.trim()}`.trim();
  return {
    assertions: [
      { kind: "exitCode", passed: exitPassed, message: exitMessage },
      ...evaluateTextAssertions(evalCase.assertions, output),
      ...evaluateGeneratedFiles(evalCase.assertions.generatedFiles, directory),
    ],
    output,
  };
}

export async function runCliSample(evalCase: CliCase, runtime: CliRuntime): Promise<SampleResult> {
  const started = Date.now();
  const timeoutMs = (evalCase.timeoutSeconds ?? runtime.config.timeoutSeconds) * 1000;
  const staged =
    evalCase.environment === undefined
      ? undefined
      : await runtime.stager.stage({
          config: runtime.config,
          evalCase,
          client: runtime.profile.subject.client,
          sourceRoot: runtime.sourceRoot,
          variantPlugins: [],
          variantEnvironment: {},
        });
  try {
    const directory = staged?.sessionDirectory ?? runtime.sourceRoot;
    const environment = substituteSessionInAll(
      { ...runtime.config.subject.environment, ...staged?.environment },
      directory,
    );
    const { assertions, output } = await runInDirectory(evalCase, directory, environment, timeoutMs);
    return {
      caseKey: caseKey(evalCase),
      repetition: 1,
      passed: assertions.every((assertion) => assertion.passed),
      assertions,
      output,
      tokenUsage: EMPTY_TOKEN_USAGE,
      toolOutputCharacters: 0,
      durationMs: Date.now() - started,
    };
  } finally {
    await staged?.dispose();
  }
}
