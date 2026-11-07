import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { caseKey } from "../../domain/cases.js";
import type { SampleResult } from "../../domain/results.js";
import { sampleFilePath, type JobFile } from "./jobSample.js";
import { readSamples } from "./promptfooResults.js";
import type { ModelCaseExecutor, ModelExecutionOptions, ModelSampleRequest } from "../run/modelCaseExecutor.js";
import { instrumentFailureSample, type SampleSettings } from "../samples/sampleRuntime.js";

export const PROMPTFOO_BINARY_VARIABLE = "AGENT_EVALS_PROMPTFOO";
const INSTALL_HINT =
  "Instale o promptfoo com `npm install --save-dev promptfoo` ou aponte AGENT_EVALS_PROMPTFOO para o binário.";

interface ChildOutcome {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  missing: boolean;
}

function runChild(binary: string, args: string[], stateDirectory?: string): Promise<ChildOutcome> {
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      env: {
        ...process.env,
        PROMPTFOO_DISABLE_TELEMETRY: "1",
        PROMPTFOO_DISABLE_UPDATE: "1",
        ...(stateDirectory === undefined ? {} : { PROMPTFOO_CONFIG_DIR: stateDirectory }),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      resolve({ exitCode: null, stdout, stderr: error.message, missing });
    });
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr, missing: false }));
  });
}

export function providerModuleSource(sampleModuleUrl: string): string {
  return [
    `import { runJobSample } from ${JSON.stringify(sampleModuleUrl)};`,
    "export default class AgentEvalsProvider {",
    '  id() { return "agent-evals"; }',
    "  async callApi(_prompt, context) {",
    "    const sample = await runJobSample(context.vars.jobFile, Number(context.vars.jobIndex));",
    "    return { output: sample.output, metadata: { sample } };",
    "  }",
    "}",
    "",
  ].join("\n");
}

export function buildPromptfooConfig(
  requests: readonly ModelSampleRequest[],
  providerPath: string,
  jobFilePath: string,
  concurrency: number,
): Record<string, unknown> {
  return {
    description: "agent-evals",
    prompts: ["{{jobIndex}}"],
    providers: [`file://${providerPath}`],
    evaluateOptions: { maxConcurrency: concurrency, cache: false },
    tests: requests.map((request, jobIndex) => ({
      description: `${caseKey(request.evalCase)}#${request.repetition}${request.control ? " (controle)" : ""}`,
      vars: { jobIndex, jobFile: jobFilePath },
    })),
  };
}

export interface PromptfooExecutorOptions {
  compositionModuleUrl: string;
  sampleModuleUrl?: string;
}

const REQUESTS_PER_PROMPTFOO_RUN = 40;
const PROMPTFOO_ATTEMPTS_PER_CHUNK = 3;

interface ChunkOutcome {
  samples: (SampleResult | undefined)[];
  missingMessage: string;
}

function recordedSample(jobFilePath: string, index: number): SampleResult | undefined {
  try {
    return JSON.parse(readFileSync(sampleFilePath(jobFilePath, index), "utf8")) as SampleResult;
  } catch {
    return undefined;
  }
}

async function runChunk(
  binary: string,
  sampleModuleUrl: string,
  executorOptions: PromptfooExecutorOptions,
  settings: SampleSettings,
  requests: readonly ModelSampleRequest[],
  options: ModelExecutionOptions,
): Promise<ChunkOutcome> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-evals-promptfoo-"));
  try {
    const providerPath = path.join(directory, "provider.mjs");
    const jobFilePath = path.join(directory, "job.json");
    const configPath = path.join(directory, "promptfooconfig.json");
    const resultsPath = path.join(directory, "results.json");
    const job: JobFile = {
      settings,
      requests: [...requests],
      compositionModuleUrl: executorOptions.compositionModuleUrl,
    };
    await writeFile(providerPath, providerModuleSource(sampleModuleUrl));
    await writeFile(jobFilePath, JSON.stringify(job));
    await writeFile(
      configPath,
      JSON.stringify(buildPromptfooConfig(requests, providerPath, jobFilePath, options.concurrency)),
    );
    const outcome = await runChild(
      binary,
      ["eval", "-c", configPath, "--output", resultsPath, "--no-cache", "--no-table"],
      path.join(directory, "state"),
    );
    const resultsContent = await readFile(resultsPath, "utf8").catch(() => undefined);
    const missingMessage =
      resultsContent === undefined
        ? `O promptfoo terminou com código ${outcome.exitCode} sem gravar resultados: ${outcome.stderr.trim().slice(-500)}`
        : "O promptfoo não devolveu resultado para a amostra.";
    return {
      samples: readSamples(resultsContent, requests, (index) => recordedSample(jobFilePath, index)),
      missingMessage,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function runChunkUntilComplete(
  runPending: (pending: readonly ModelSampleRequest[]) => Promise<ChunkOutcome>,
  requests: readonly ModelSampleRequest[],
): Promise<SampleResult[]> {
  const samples: (SampleResult | undefined)[] = new Array<SampleResult | undefined>(requests.length).fill(undefined);
  let missingMessage = "";
  for (let attempt = 0; attempt < PROMPTFOO_ATTEMPTS_PER_CHUNK; attempt += 1) {
    const pendingIndices = requests.flatMap((_, index) => (samples[index] === undefined ? [index] : []));
    if (pendingIndices.length === 0) break;
    const outcome = await runPending(pendingIndices.map((index) => requests[index]!));
    pendingIndices.forEach((requestIndex, pendingIndex) => (samples[requestIndex] = outcome.samples[pendingIndex]));
    missingMessage = outcome.missingMessage;
  }
  return requests.map(
    (request, index) =>
      samples[index] ??
      instrumentFailureSample(
        caseKey(request.evalCase),
        request.repetition,
        { kind: "client-error", message: missingMessage },
        0,
      ),
  );
}

export function createPromptfooExecutor(executorOptions: PromptfooExecutorOptions): ModelCaseExecutor {
  const binary = process.env[PROMPTFOO_BINARY_VARIABLE] ?? "promptfoo";
  const sampleModuleUrl = executorOptions.sampleModuleUrl ?? new URL("./jobSample.js", import.meta.url).href;
  return {
    async version() {
      const outcome = await runChild(binary, ["--version"]);
      return outcome.missing || outcome.exitCode !== 0 ? undefined : outcome.stdout.trim();
    },
    async execute(settings: SampleSettings, requests, options: ModelExecutionOptions) {
      if ((await this.version()) === undefined) {
        throw new Error(`promptfoo não encontrado (${binary}). ${INSTALL_HINT}`);
      }
      const samples: SampleResult[] = [];
      for (let offset = 0; offset < requests.length; offset += REQUESTS_PER_PROMPTFOO_RUN) {
        const chunk = requests.slice(offset, offset + REQUESTS_PER_PROMPTFOO_RUN);
        const chunkSamples = await runChunkUntilComplete(
          (pending) => runChunk(binary, sampleModuleUrl, executorOptions, settings, pending, options),
          chunk,
        );
        chunk.forEach((request, index) => options.onSample?.(request, chunkSamples[index]!));
        samples.push(...chunkSamples);
      }
      return samples;
    },
  };
}
