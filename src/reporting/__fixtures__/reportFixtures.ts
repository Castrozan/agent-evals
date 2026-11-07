import type { Baseline, BaselineCaseEntry, Verdict } from "../../domain/baseline.js";
import type { CaseRunResult, RunRecord, SampleResult } from "../../domain/results.js";
import type { ProjectConfig } from "../../domain/project.js";

export function sample(passed: boolean, overrides: Partial<SampleResult> = {}): SampleResult {
  return {
    caseKey: "k",
    repetition: 0,
    passed,
    assertions: passed ? [] : [{ kind: "contains", passed: false, message: "faltou <b>texto</b>" }],
    output: passed ? "ok" : "saída <script>alert(1)</script>",
    tokenUsage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, reasoning: 0 },
    toolOutputCharacters: 0,
    costUsd: 0.25,
    durationMs: 2000,
    ...overrides,
  };
}

export function caseResult(name: string, outcomes: boolean[], overrides: Partial<CaseRunResult> = {}): CaseRunResult {
  return {
    caseKey: `cat/${name}`,
    category: "cat",
    name,
    level: "unit",
    type: "instruction",
    prompt: "pergunta",
    expected: ["esperado"],
    fingerprint: "f",
    heldOut: false,
    samples: outcomes.map((passed) => sample(passed)),
    ...overrides,
  };
}

export function baselineEntry(
  name: string,
  passes: number,
  samples: number,
  measuredAt = "2026-01-01T00:00:00Z",
): BaselineCaseEntry {
  return {
    category: "cat",
    name,
    level: "unit",
    type: "instruction",
    heldOut: false,
    fingerprint: "f",
    samples,
    passes,
    sampleOutcomes: [...Array(passes).fill(true), ...Array(samples - passes).fill(false)],
    tokenTotals: [],
    toolOutputCharacters: [],
    costUsd: 1,
    measuredAt,
  };
}

export function baselineOf(entries: BaselineCaseEntry[]): Baseline {
  return {
    measurementContract: 1,
    instrument: { agentEvals: "0.1.0", measurementContract: 1, sdks: {} },
    recordedAt: "2026-01-01T00:00:00Z",
    cases: Object.fromEntries(entries.map((entry) => [`${entry.category}/${entry.name}`, entry])),
    instructionFingerprints: {},
    leakedSkills: [],
  };
}

export function runOf(cases: CaseRunResult[], overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    project: "demo",
    startedAt: "2026-02-01T00:00:00Z",
    finishedAt: "2026-02-01T00:10:00Z",
    profile: { subject: { client: "claude", model: "m" }, judge: { client: "claude" } },
    profileId: "abc",
    instrument: { agentEvals: "0.1.0", measurementContract: 1, sdks: { claude: "1.0" } },
    selection: { categories: [], cases: [], affected: false, partial: false },
    overlaidPaths: 0,
    leakedSkills: [],
    instructionFingerprints: {},
    cases,
    ...overrides,
  };
}

export const passingVerdict: Verdict = { passed: true, invalid: false, reasons: [], notices: [] };

export const config = {
  project: "demo",
  root: "/tmp",
  reportPath: "r.html",
  pagesDirectory: "public",
} as ProjectConfig;
