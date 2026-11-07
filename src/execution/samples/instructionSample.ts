import { evaluateCommandChecks } from "../../assertions/commandChecks.js";
import { evaluateGeneratedFiles } from "../../assertions/generatedFiles.js";
import { evaluateSessionUsage } from "../../assertions/sessionUsage.js";
import { evaluateTextAssertions } from "../../assertions/text.js";
import type { InstructionCase } from "../../domain/cases.js";
import { caseKey } from "../../domain/cases.js";
import type { StagedSession, SubjectInvocation } from "../../domain/ports.js";
import type { AssertionOutcome, InstrumentFailure, SampleResult, SessionTranscript } from "../../domain/results.js";
import { createGrader, type Grader } from "../../judge/grade.js";
import { judgeOnCommand } from "../../judge/judgeOnCommand.js";
import { buildUnitSystemPrompt } from "./instructionSurface.js";
import {
  instrumentFailureSample,
  SOURCE_ROOT_VARIABLE,
  substituteSessionInAll,
  type SampleRuntime,
} from "./sampleRuntime.js";

function timeoutMillisecondsOf(evalCase: InstructionCase, runtime: SampleRuntime): number {
  return (evalCase.timeoutSeconds ?? runtime.config.timeoutSeconds) * 1000;
}

function subjectEnvironment(runtime: SampleRuntime, staged: StagedSession): Record<string, string> {
  return substituteSessionInAll(
    {
      ...runtime.config.subject.environment,
      ...runtime.variantEnvironment,
      ...staged.environment,
      [SOURCE_ROOT_VARIABLE]: runtime.sourceRoot,
    },
    staged.sessionDirectory,
  );
}

export function buildInvocation(
  evalCase: InstructionCase,
  runtime: SampleRuntime,
  staged: StagedSession,
): SubjectInvocation {
  const unit = evalCase.level === "unit";
  const { subject } = runtime.profile;
  return {
    client: subject.client,
    model: subject.model,
    effort: subject.effort,
    systemPrompt: unit ? buildUnitSystemPrompt(evalCase, runtime.sourceRoot) : evalCase.systemPrompt,
    prompt: evalCase.prompt,
    workingDirectory: staged.sessionDirectory,
    posture: unit ? "none" : evalCase.writes ? "write" : "read-only",
    stagesGit: evalCase.environment?.git !== undefined && evalCase.environment.git !== false,
    pluginDirectories: staged.pluginDirectories,
    environment: subjectEnvironment(runtime, staged),
    removedEnvironment: runtime.config.subject.removedEnvironment,
    timeoutMs: timeoutMillisecondsOf(evalCase, runtime),
    isolatedContext: false,
  };
}

function createJudgeGrader(evalCase: InstructionCase, runtime: SampleRuntime): Grader {
  const { judge, subject } = runtime.profile;
  return createGrader({
    client: runtime.clients(judge.client),
    model: judge.model ?? subject.model,
    effort: judge.effort,
    timeoutMs: timeoutMillisecondsOf(evalCase, runtime),
    removedEnvironment: runtime.config.subject.removedEnvironment,
  });
}

interface JudgedOutcomes {
  outcomes: AssertionOutcome[];
  instrumentFailure?: InstrumentFailure;
}

async function judgeAll(
  evalCase: InstructionCase,
  transcript: SessionTranscript,
  grader: Grader,
  runtime: SampleRuntime,
  staged: StagedSession,
  invocation: SubjectInvocation,
): Promise<JudgedOutcomes> {
  const outcomes: AssertionOutcome[] = [];
  for (const criterion of evalCase.assertions.judge) {
    const graded = await grader({ criterion, request: evalCase.prompt, response: transcript.text });
    if (graded.instrumentFailure !== undefined) return { outcomes, instrumentFailure: graded.instrumentFailure };
    outcomes.push({
      kind: "judge",
      passed: graded.verdict === "pass",
      message: `Juiz: ${graded.verdict === "pass" ? "aprovado" : graded.verdict === "fail" ? "reprovado" : "sem veredito"} para "${criterion}".`,
    });
  }
  for (const judged of evalCase.assertions.judgeOnCommand) {
    const result = await judgeOnCommand(judged, {
      grader,
      sourceRoot: runtime.sourceRoot,
      cwd: staged.sessionDirectory,
      environment: invocation.environment,
      timeoutMs: invocation.timeoutMs,
    });
    outcomes.push(...result.outcomes);
    if (result.instrumentFailure !== undefined) return { outcomes, instrumentFailure: result.instrumentFailure };
  }
  return { outcomes };
}

function sampleFrom(
  evalCase: InstructionCase,
  repetition: number,
  transcript: SessionTranscript,
  assertions: AssertionOutcome[],
  instrumentFailure: InstrumentFailure | undefined,
): SampleResult {
  return {
    caseKey: caseKey(evalCase),
    repetition,
    passed: instrumentFailure === undefined && assertions.every((assertion) => assertion.passed),
    assertions: instrumentFailure === undefined ? assertions : [],
    output: transcript.text,
    instrumentFailure,
    tokenUsage: transcript.tokenUsage,
    toolOutputCharacters: transcript.toolOutputCharacters,
    costUsd: transcript.costUsd,
    durationMs: transcript.durationMs,
  };
}

async function measure(
  evalCase: InstructionCase,
  repetition: number,
  runtime: SampleRuntime,
  staged: StagedSession,
): Promise<SampleResult> {
  const invocation = buildInvocation(evalCase, runtime, staged);
  const transcript = await runtime.clients(invocation.client).run(invocation);
  if (transcript.instrumentFailure !== undefined) {
    return sampleFrom(evalCase, repetition, transcript, [], transcript.instrumentFailure);
  }
  const { assertions } = evalCase;
  const outcomes = [
    ...evaluateTextAssertions(assertions, transcript.text),
    ...evaluateSessionUsage(assertions, transcript),
    ...evaluateGeneratedFiles(assertions.generatedFiles, staged.sessionDirectory),
    ...(await evaluateCommandChecks(assertions.commands, {
      cwd: staged.sessionDirectory,
      environment: invocation.environment,
      timeoutMs: invocation.timeoutMs,
    })),
  ];
  const judged = await judgeAll(
    evalCase,
    transcript,
    createJudgeGrader(evalCase, runtime),
    runtime,
    staged,
    invocation,
  );
  return sampleFrom(evalCase, repetition, transcript, [...outcomes, ...judged.outcomes], judged.instrumentFailure);
}

export async function runInstructionSample(
  evalCase: InstructionCase,
  repetition: number,
  runtime: SampleRuntime,
): Promise<SampleResult> {
  const started = Date.now();
  const staged = await runtime.stager.stage({
    config: runtime.config,
    evalCase,
    client: runtime.profile.subject.client,
    sourceRoot: runtime.sourceRoot,
    variantPlugins: runtime.variantPlugins,
    variantEnvironment: runtime.variantEnvironment,
  });
  try {
    return await measure(evalCase, repetition, runtime, staged);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return instrumentFailureSample(
      caseKey(evalCase),
      repetition,
      { kind: "client-error", message },
      Date.now() - started,
    );
  } finally {
    await staged.dispose();
  }
}
