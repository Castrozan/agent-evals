import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { caseKey } from "../domain/cases.js";
import type { SampleResult } from "../domain/results.js";
import type { JobFile } from "./jobSample.js";
import type { ModelCaseExecutor, ModelExecutionOptions, ModelSampleRequest } from "./modelCaseExecutor.js";
import { instrumentFailureSample, type SampleSettings } from "./sampleRuntime.js";

export const PROMPTFOO_BINARY_VARIABLE = "AGENT_EVALS_PROMPTFOO";
const INSTALL_HINT =
  "Instale o promptfoo com `npm install --save-dev promptfoo` ou aponte AGENT_EVALS_PROMPTFOO para o binário.";

interface ChildOutcome {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  missing: boolean;
}

function runChild(binary: string, args: string[]): Promise<ChildOutcome> {
  return new Promise((resolve) => {
    const child = spawn(binary, args, {
      env: { ...process.env, PROMPTFOO_DISABLE_TELEMETRY: "1", PROMPTFOO_DISABLE_UPDATE: "1" },
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

interface ResultRow {
  vars?: { jobIndex?: number | string };
  response?: { metadata?: { sample?: SampleResult } };
  error?: string;
}

export function readSamples(resultsContent: string, requests: readonly ModelSampleRequest[]): SampleResult[] {
  const parsed = JSON.parse(resultsContent) as { results?: { results?: ResultRow[] } };
  const samples: (SampleResult | undefined)[] = new Array<SampleResult | undefined>(requests.length).fill(undefined);
  for (const row of parsed.results?.results ?? []) {
    const index = Number(row.vars?.jobIndex);
    const request = requests[index];
    if (request === undefined) continue;
    const sample = row.response?.metadata?.sample;
    if (sample !== undefined) {
      samples[index] = sample;
      continue;
    }
    if (row.error !== undefined) throw new Error(`Falha no promptfoo em ${caseKey(request.evalCase)}: ${row.error}`);
  }
  return requests.map(
    (request, index) =>
      samples[index] ??
      instrumentFailureSample(
        caseKey(request.evalCase),
        request.repetition,
        { kind: "client-error", message: "O promptfoo não devolveu resultado para a amostra." },
        0,
      ),
  );
}

export interface PromptfooExecutorOptions {
  compositionModuleUrl: string;
  sampleModuleUrl?: string;
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
        const config = buildPromptfooConfig(requests, providerPath, jobFilePath, options.concurrency);
        await writeFile(configPath, JSON.stringify(config));
        const outcome = await runChild(binary, [
          "eval",
          "-c",
          configPath,
          "--output",
          resultsPath,
          "--no-cache",
          "--no-write",
          "--no-table",
        ]);
        const resultsContent = await readFile(resultsPath, "utf8").catch(() => undefined);
        if (resultsContent === undefined) {
          throw new Error(
            `O promptfoo terminou com código ${outcome.exitCode} sem gravar resultados: ${outcome.stderr.trim()}`,
          );
        }
        const samples = readSamples(resultsContent, requests);
        requests.forEach((request, index) => options.onSample?.(request, samples[index]!));
        return samples;
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}
