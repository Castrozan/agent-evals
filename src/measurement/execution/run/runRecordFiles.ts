import { randomBytes } from "node:crypto";
import { appendFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { EvalCase } from "../../../domain/cases.js";
import type { SampleResult } from "../../../domain/results.js";

export const RUN_RECORD_FILE = "results.jsonl";

export function stateRunsDirectory(environment: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  const stateHome = environment.XDG_STATE_HOME ?? path.join(home, ".local", "state");
  return path.join(stateHome, "agent-evals", "runs");
}

export function createRunDirectory(runsDirectory: string, now: Date): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const directory = path.join(runsDirectory, `${stamp}-${randomBytes(3).toString("hex")}`);
  mkdirSync(directory, { recursive: true });
  return directory;
}

export function appendRunRecord(
  runDirectory: string,
  evalCase: EvalCase,
  sample: SampleResult,
  control: boolean,
): void {
  const line = {
    category: evalCase.category,
    name: evalCase.name,
    repetition: sample.repetition,
    control,
    passed: sample.passed,
    durationMs: sample.durationMs,
    assertions: sample.assertions,
    error: sample.instrumentFailure?.message,
    output: sample.output,
  };
  appendFileSync(path.join(runDirectory, RUN_RECORD_FILE), `${JSON.stringify(line)}\n`);
}
