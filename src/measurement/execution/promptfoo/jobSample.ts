import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { SessionStager } from "../../../domain/ports.js";
import type { SampleResult } from "../../../domain/results.js";
import { createInProcessExecutor, type ModelSampleRequest } from "../run/modelCaseExecutor.js";
import type { SampleSettings, SubjectClientFactory } from "../samples/sampleRuntime.js";

export interface JobFile {
  settings: SampleSettings;
  requests: ModelSampleRequest[];
  compositionModuleUrl: string;
}

export interface RuntimeServices {
  clients: SubjectClientFactory;
  stager: SessionStager;
}

interface CompositionModule {
  createRuntimeServices(): RuntimeServices | Promise<RuntimeServices>;
}

const servicesByModule = new Map<string, Promise<RuntimeServices>>();

function loadServices(compositionModuleUrl: string): Promise<RuntimeServices> {
  const cached = servicesByModule.get(compositionModuleUrl);
  if (cached !== undefined) return cached;
  const loaded = (import(compositionModuleUrl) as Promise<CompositionModule>).then((module) =>
    module.createRuntimeServices(),
  );
  servicesByModule.set(compositionModuleUrl, loaded);
  return loaded;
}

export async function runJobSample(jobFilePath: string, jobIndex: number): Promise<SampleResult> {
  const job = JSON.parse(readFileSync(jobFilePath, "utf8")) as JobFile;
  const request = job.requests[jobIndex];
  if (request === undefined) throw new Error(`Amostra ${jobIndex} inexistente no arquivo de trabalho ${jobFilePath}.`);
  const services = await loadServices(job.compositionModuleUrl);
  const executor = createInProcessExecutor({ ...job.settings, ...services });
  const [sample] = await executor.execute(job.settings, [request], { concurrency: 1 });
  const recordedPath = sampleFilePath(jobFilePath, jobIndex);
  mkdirSync(path.dirname(recordedPath), { recursive: true });
  writeFileSync(recordedPath, JSON.stringify(sample));
  return sample!;
}

export function sampleFilePath(jobFilePath: string, jobIndex: number): string {
  return path.join(path.dirname(jobFilePath), "samples", `${jobIndex}.json`);
}
