import type { Baseline, BaselineCaseEntry } from "../../domain/baseline.js";
import type { RunRecord } from "../../domain/results.js";
import { runRecordToEntries } from "./entries.js";

function accumulate(previous: BaselineCaseEntry, measured: BaselineCaseEntry): BaselineCaseEntry {
  return {
    ...measured,
    samples: previous.samples + measured.samples,
    passes: previous.passes + measured.passes,
    sampleOutcomes: [...previous.sampleOutcomes, ...measured.sampleOutcomes],
    tokenTotals: [...previous.tokenTotals, ...measured.tokenTotals],
    toolOutputCharacters: [...previous.toolOutputCharacters, ...measured.toolOutputCharacters],
    costUsd: previous.costUsd + measured.costUsd,
  };
}

export function assertRunCanBecomeBaseline(run: RunRecord): void {
  if (run.invalid !== undefined) {
    throw new Error(`Execução inválida, a baseline não será gravada: ${run.invalid.reason}.`);
  }
  if (run.selection.partition !== undefined) {
    throw new Error("Execução parcial por partição não pode virar baseline: rode a suíte inteira.");
  }
}

export function mergeBaseline(
  previous: Baseline | undefined,
  run: RunRecord,
  suiteCaseKeys: readonly string[],
  now: Date,
): Baseline {
  assertRunCanBecomeBaseline(run);
  const suiteKeys = new Set(suiteCaseKeys);
  const cases: Record<string, BaselineCaseEntry> = {};
  for (const [caseKey, entry] of Object.entries(previous?.cases ?? {})) {
    if (suiteKeys.has(caseKey)) cases[caseKey] = entry;
  }
  for (const [caseKey, measured] of Object.entries(runRecordToEntries(run))) {
    const existing = cases[caseKey];
    cases[caseKey] = existing?.fingerprint === measured.fingerprint ? accumulate(existing, measured) : measured;
  }
  const inheritsPrevious = run.selection.partial && previous !== undefined;
  return {
    measurementContract: run.instrument.measurementContract,
    instrument: run.instrument,
    profile: run.profile,
    profileId: run.profileId,
    ...(run.variant === undefined ? {} : { variant: run.variant }),
    recordedAt: now.toISOString(),
    cases,
    instructionFingerprints: inheritsPrevious
      ? { ...previous.instructionFingerprints, ...run.instructionFingerprints }
      : run.instructionFingerprints,
    leakedSkills: [...new Set([...(inheritsPrevious ? previous.leakedSkills : []), ...run.leakedSkills])].sort(),
  };
}
