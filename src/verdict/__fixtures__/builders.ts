import type { Baseline, BaselineCaseEntry } from "../../domain/baseline.js";
import type { InstructionCase } from "../../domain/cases.js";
import type { ProjectConfig } from "../../domain/project.js";
import type { CaseRunResult, RunRecord, SampleResult } from "../../domain/results.js";

export function makeConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    root: "/repo",
    project: "demo",
    casePatterns: { any: [], byKind: {} },
    baselinePath: "evals/baseline.json",
    reportPath: "evals/resultado/relatorio.html",
    pagesDirectory: "public",
    defaultModel: { scalar: "model-a", byClient: {} },
    defaultEffort: { byClient: {} },
    subject: { canonicalClient: "claude", environment: {}, removedEnvironment: [] },
    judge: { client: "claude", model: "judge-model", calibrationPath: "evals/calibracao.yaml" },
    discovery: { instructions: ["CLAUDE.md"], ignore: [] },
    validateInstructionFormat: true,
    repetitionsByLevel: { unit: 1, integration: 1, "end-to-end": 1 },
    thresholds: {
      overallFloor: 0.75,
      criticalFloor: 0.85,
      maxDrop: 0.05,
      validityDays: 30,
      criticalCategories: [],
      requiredCategories: [],
      minimumRepetitions: 2,
    },
    parallelism: 4,
    timeoutSeconds: 180,
    variants: {},
    ...overrides,
  };
}

export function makeCase(category: string, name: string, overrides: Partial<InstructionCase> = {}): InstructionCase {
  return {
    category,
    name,
    level: "unit",
    sourceFile: "evals/cases.yaml",
    pending: false,
    heldOut: false,
    type: "instruction",
    extraInstructions: [],
    prompt: "pergunta",
    models: {},
    writes: false,
    assertions: {
      judge: ["criterio"],
      contains: [],
      equals: [],
      notContains: [],
      regex: [],
      notRegex: [],
      skillsUsed: [],
      skillsForbidden: [],
      toolsUsed: [],
      toolsForbidden: [],
      commandsRun: [],
      commandsRunForbidden: [],
      generatedFiles: [],
      commands: [],
      judgeOnCommand: [],
    },
    ...overrides,
  };
}

export function makeEntry(
  category: string,
  name: string,
  outcomes: boolean[],
  overrides: Partial<BaselineCaseEntry> = {},
): BaselineCaseEntry {
  return {
    category,
    name,
    level: "unit",
    type: "instruction",
    heldOut: false,
    fingerprint: "fp",
    samples: outcomes.length,
    passes: outcomes.filter(Boolean).length,
    sampleOutcomes: outcomes,
    tokenTotals: outcomes.map(() => 100),
    toolOutputCharacters: outcomes.map(() => 10),
    costUsd: 0.01 * outcomes.length,
    measuredAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeBaseline(entries: BaselineCaseEntry[], overrides: Partial<Baseline> = {}): Baseline {
  return {
    measurementContract: 1,
    instrument: { agentEvals: "0.1.0", measurementContract: 1, promptfoo: "0.118.2", sdks: { claude: "0.3.319" } },
    recordedAt: "2026-11-01T00:00:00.000Z",
    cases: Object.fromEntries(entries.map((entry) => [`${entry.category}/${entry.name}`, entry])),
    instructionFingerprints: {},
    leakedSkills: [],
    ...overrides,
  };
}

export function makeSample(passed: boolean, overrides: Partial<SampleResult> = {}): SampleResult {
  return {
    caseKey: "c/a",
    repetition: 0,
    passed,
    assertions: [],
    output: "",
    tokenUsage: { input: 10, output: 5, cacheRead: 1, cacheWrite: 1, reasoning: 0 },
    toolOutputCharacters: 7,
    costUsd: 0.5,
    durationMs: 1,
    ...overrides,
  };
}

export function makeCaseResult(
  name: string,
  samples: SampleResult[],
  overrides: Partial<CaseRunResult> = {},
): CaseRunResult {
  return {
    caseKey: `c/${name}`,
    category: "c",
    name,
    level: "unit",
    type: "instruction",
    fingerprint: "fp",
    heldOut: false,
    samples,
    ...overrides,
  };
}

export function makeRun(cases: CaseRunResult[], overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    project: "demo",
    startedAt: "2026-11-06T00:00:00.000Z",
    finishedAt: "2026-11-06T01:00:00.000Z",
    profile: { subject: { client: "claude", model: "model-a" }, judge: { client: "claude", model: "judge-model" } },
    profileId: "abc",
    instrument: { agentEvals: "0.1.0", measurementContract: 1, promptfoo: "0.118.2", sdks: { claude: "0.3.319" } },
    selection: { categories: [], cases: [], affected: false, partial: false },
    overlaidPaths: 0,
    leakedSkills: [],
    instructionFingerprints: {},
    cases,
    ...overrides,
  };
}
