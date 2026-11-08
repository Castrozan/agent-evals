import { rm } from "node:fs/promises";
import path from "node:path";
import type { SubjectClient } from "../../domain/ports.js";
import type { InstrumentFailure } from "../../domain/results.js";
import { buildJudgePrompt, parseJudgeVerdict, type JudgeInput, type JudgeVerdict } from "./prompt.js";
import { createScratchDirectory } from "../runtime/scratch.js";

export interface JudgeSettings {
  client: SubjectClient;
  model: string;
  effort?: string;
  timeoutMs: number;
  removedEnvironment: string[];
}

export interface GradeResult {
  verdict: JudgeVerdict;
  instrumentFailure?: InstrumentFailure;
}

export type Grader = (input: JudgeInput) => Promise<GradeResult>;

export async function grade(settings: JudgeSettings, input: JudgeInput): Promise<GradeResult> {
  const workingDirectory = await createScratchDirectory("agent-evals-judge-");
  try {
    const transcript = await settings.client.run({
      client: settings.client.client,
      model: settings.model,
      effort: settings.effort,
      prompt: buildJudgePrompt(input),
      workingDirectory,
      sessionRoot: workingDirectory,
      posture: "none",
      stagesGit: false,
      pluginDirectories: [],
      environment: {},
      removedEnvironment: settings.removedEnvironment,
      timeoutMs: settings.timeoutMs,
      isolatedContext: true,
    });
    if (transcript.instrumentFailure !== undefined) {
      return { verdict: "no-verdict", instrumentFailure: transcript.instrumentFailure };
    }
    return { verdict: parseJudgeVerdict(transcript.text) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { verdict: "no-verdict", instrumentFailure: { kind: "client-error", message } };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

export function createGrader(settings: JudgeSettings): Grader {
  return (input) => grade(settings, input);
}
