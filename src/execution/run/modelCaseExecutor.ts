import type { InstructionCase } from "../../domain/cases.js";
import type { SampleResult } from "../../domain/results.js";
import { runInstructionSample } from "../samples/instructionSample.js";
import type { SampleRuntime, SampleSettings } from "../samples/sampleRuntime.js";
import { runWithConcurrency } from "./workerPool.js";

export interface ModelSampleRequest {
  evalCase: InstructionCase;
  repetition: number;
  control: boolean;
}

export interface ModelExecutionOptions {
  concurrency: number;
  onSample?: (request: ModelSampleRequest, sample: SampleResult) => void;
}

export interface ModelCaseExecutor {
  version(): Promise<string | undefined>;
  execute(
    settings: SampleSettings,
    requests: readonly ModelSampleRequest[],
    options: ModelExecutionOptions,
  ): Promise<SampleResult[]>;
}

export function createInProcessExecutor(runtime: SampleRuntime): ModelCaseExecutor {
  return {
    version: async () => undefined,
    execute: (_settings, requests, options) =>
      runWithConcurrency(requests, options.concurrency, async (request) => {
        const sample = await runInstructionSample(request.evalCase, request.repetition, runtime);
        options.onSample?.(request, sample);
        return sample;
      }),
  };
}
