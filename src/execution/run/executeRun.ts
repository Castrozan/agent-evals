import type { EvalCase, InstructionCase } from "../../domain/cases.js";
import { caseKey } from "../../domain/cases.js";
import type { ExecutionProfile } from "../../domain/clients.js";
import type { SessionStager } from "../../domain/ports.js";
import type { ProjectConfig } from "../../domain/project.js";
import type { CaseRunResult, RunRecord, RunSelection, SampleResult } from "../../domain/results.js";
import { caseFingerprint, instructionFingerprints } from "../../fingerprint/index.js";
import { profileId } from "../../profile/index.js";
import { assessRunValidity } from "../../verdict/runValidity.js";
import { runCliSample } from "../samples/cliSample.js";
import { hasInstructionSurface, withoutInstructionSurface } from "../samples/instructionSurface.js";
import { buildInstrumentVersions } from "./instrumentVersions.js";
import {
  appendJournalEntry,
  discardJournal,
  journalPathFor,
  readJournal,
  reusableSamples,
  type JournalEntry,
} from "./journal.js";
import { runMcpSample } from "../samples/mcpSample.js";
import type { ModelCaseExecutor, ModelSampleRequest } from "./modelCaseExecutor.js";
import { comparePairedControl } from "./pairedControl.js";
import { planRun, type RunPlan } from "./plan.js";
import { repetitionsFor } from "./repetitions.js";
import { runWithConcurrency } from "./workerPool.js";
import { appendRunRecord, createRunDirectory, stateRunsDirectory } from "./runRecordFiles.js";
import type { SubjectClientFactory } from "../samples/sampleRuntime.js";

export interface ExecuteRunOptions {
  config: ProjectConfig;
  cases: readonly EvalCase[];
  profile: ExecutionProfile;
  clients: SubjectClientFactory;
  stager: SessionStager;
  executor: ModelCaseExecutor;
  workingTreeDirectory: string;
  selection: RunSelection;
  variant?: string;
  revision?: string;
  commit?: string;
  overlaidPaths?: number;
  resume: boolean;
  paired: boolean;
  workers?: number;
  repetitionsMultiplier: number;
  dryRun: boolean;
  write: (line: string) => void;
  journalPath?: string;
  runsDirectory?: string;
}

export type ExecutionOutcome = { kind: "plan"; plan: RunPlan } | { kind: "record"; record: RunRecord };

function sortedByRepetition(samples: SampleResult[]): SampleResult[] {
  return samples.sort((left, right) => left.repetition - right.repetition);
}

export async function executeRun(options: ExecuteRunOptions): Promise<ExecutionOutcome> {
  const { config, cases, profile } = options;
  if (options.dryRun) return { kind: "plan", plan: planRun(config, cases, profile, options.repetitionsMultiplier) };
  const startedAt = new Date();
  const id = profileId(profile);
  const root = options.workingTreeDirectory;
  const journalPath = options.journalPath ?? journalPathFor(config.root);
  if (!options.resume) discardJournal(journalPath);
  const journal = options.resume ? readJournal(journalPath) : [];
  const runDirectory = createRunDirectory(options.runsDirectory ?? stateRunsDirectory(), startedAt);
  const fingerprints = new Map(cases.map((evalCase) => [caseKey(evalCase), caseFingerprint(evalCase, root)]));
  const variantDeclaration = options.variant === undefined ? undefined : config.variants[options.variant];
  const settings = {
    config,
    profile,
    sourceRoot: root,
    variantPlugins: variantDeclaration?.plugins ?? [],
    variantEnvironment: variantDeclaration?.environment ?? {},
  };
  const instructionCases = cases.filter((evalCase): evalCase is InstructionCase => evalCase.type === "instruction");
  const samplesByKey = new Map<string, SampleResult[]>();
  const controlsByKey = new Map<string, SampleResult[]>();
  const requests: ModelSampleRequest[] = [];
  const bucketOf = (request: ModelSampleRequest) => (request.control ? controlsByKey : samplesByKey);
  const plan = (evalCase: InstructionCase, control: boolean) => {
    const key = caseKey(evalCase);
    const identity = {
      caseKey: key,
      fingerprint: fingerprints.get(key)!,
      profileId: id,
      variant: options.variant,
      control,
    };
    const total = repetitionsFor(config, evalCase, options.repetitionsMultiplier);
    const reused = sortedByRepetition(reusableSamples(journal, identity)).slice(0, total);
    (control ? controlsByKey : samplesByKey).set(key, reused);
    for (let repetition = reused.length + 1; repetition <= total; repetition += 1) {
      requests.push({ evalCase: control ? withoutInstructionSurface(evalCase) : evalCase, repetition, control });
    }
    if (reused.length > 0) options.write(`Reaproveitadas ${reused.length} amostra(s) de ${key}.`);
  };
  for (const evalCase of instructionCases) {
    plan(evalCase, false);
    if (options.paired && hasInstructionSurface(evalCase)) plan(evalCase, true);
  }
  const record = (request: ModelSampleRequest, sample: SampleResult) => {
    const key = caseKey(request.evalCase);
    const entry: JournalEntry = {
      caseKey: key,
      fingerprint: fingerprints.get(key)!,
      profileId: id,
      variant: options.variant,
      control: request.control,
      sample,
    };
    appendJournalEntry(journalPath, entry);
    appendRunRecord(runDirectory, request.evalCase, sample, request.control);
    bucketOf(request).get(key)!.push(sample);
    options.write(
      `${request.control ? "[controle] " : ""}${key} #${request.repetition}: ${sample.passed ? "passou" : sample.instrumentFailure ? "falha do instrumento" : "falhou"}`,
    );
  };
  const concurrency = options.workers ?? config.parallelism;
  const nonModelCases = cases.filter((evalCase) => evalCase.type !== "instruction");
  const nonModelSamples = await runWithConcurrency(nonModelCases, concurrency, async (evalCase) => {
    const sample =
      evalCase.type === "cli"
        ? await runCliSample(evalCase, { ...settings, stager: options.stager })
        : await runMcpSample(evalCase as Extract<EvalCase, { type: "mcp" }>, root, config.timeoutSeconds);
    appendRunRecord(runDirectory, evalCase, sample, false);
    options.write(`${caseKey(evalCase)}: ${sample.passed ? "passou" : "falhou"}`);
    return sample;
  });
  if (requests.length > 0) await options.executor.execute(settings, requests, { concurrency, onSample: record });
  const results: CaseRunResult[] = cases.map((evalCase) => {
    const key = caseKey(evalCase);
    const samples =
      evalCase.type === "instruction"
        ? sortedByRepetition(samplesByKey.get(key) ?? [])
        : [nonModelSamples[nonModelCases.indexOf(evalCase)]!];
    const controls = controlsByKey.get(key);
    return {
      caseKey: key,
      category: evalCase.category,
      name: evalCase.name,
      level: evalCase.level,
      type: evalCase.type,
      instruction: evalCase.type === "instruction" ? evalCase.instruction : undefined,
      prompt: evalCase.type === "instruction" ? evalCase.prompt : undefined,
      expected: evalCase.type === "instruction" ? evalCase.assertions.judge : undefined,
      fingerprint: fingerprints.get(key)!,
      heldOut: evalCase.heldOut,
      samples,
      pairedControl: controls === undefined ? undefined : comparePairedControl(samples, sortedByRepetition(controls)),
    };
  });
  const sdks: Record<string, string> = {};
  for (const client of new Set([profile.subject.client, profile.judge.client])) {
    const version = await options.clients(client).sdkVersion();
    if (version !== undefined) sdks[client] = version;
  }
  const runRecord: RunRecord = {
    project: config.project,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    profile,
    profileId: id,
    variant: options.variant,
    revision: options.revision,
    commit: options.commit,
    instrument: buildInstrumentVersions(await options.executor.version(), sdks),
    selection: options.selection,
    overlaidPaths: options.overlaidPaths ?? 0,
    leakedSkills: [],
    instructionFingerprints: instructionFingerprints(cases, root),
    cases: results,
  };
  const validity = assessRunValidity(runRecord);
  if (validity.invalid) runRecord.invalid = { reason: validity.reason! };
  discardJournal(journalPath);
  return { kind: "record", record: runRecord };
}
