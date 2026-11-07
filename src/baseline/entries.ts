import type { BaselineCaseEntry } from "../domain/baseline.js";
import { measuredSamples, totalTokens, type RunRecord } from "../domain/results.js";

export function runRecordToEntries(record: RunRecord): Record<string, BaselineCaseEntry> {
  const entries: Record<string, BaselineCaseEntry> = {};
  for (const result of record.cases) {
    const samples = measuredSamples(result);
    if (samples.length === 0) continue;
    const sampleOutcomes = samples.map((sample) => sample.passed);
    entries[result.caseKey] = {
      category: result.category,
      name: result.name,
      level: result.level,
      type: result.type,
      ...(result.instruction === undefined ? {} : { instruction: result.instruction }),
      heldOut: result.heldOut,
      fingerprint: result.fingerprint,
      samples: samples.length,
      passes: sampleOutcomes.filter(Boolean).length,
      sampleOutcomes,
      tokenTotals: samples.map((sample) => totalTokens(sample.tokenUsage)),
      toolOutputCharacters: samples.map((sample) => sample.toolOutputCharacters),
      costUsd: samples.reduce((total, sample) => total + (sample.costUsd ?? 0), 0),
      measuredAt: record.finishedAt,
    };
  }
  return entries;
}
