import type { Baseline, BaselineCaseEntry } from "../../../domain/baseline.js";
import type { CaseRunResult } from "../../../domain/results.js";
import { measuredSamples } from "../../../domain/results.js";
import { isFlaky } from "../../statistics/proportions.js";
import type { CaseStatus, ReportCase } from "./reportDocument.js";

const PASSING_CASE_RATE = 0.5;

function statusOf(samples: number, passes: number): CaseStatus {
  if (samples === 0) return "unmeasured";
  return passes / samples >= PASSING_CASE_RATE ? "passed" : "failed";
}

function measuredCase(result: CaseRunResult, measuredAt: string): ReportCase {
  const samples = measuredSamples(result);
  const outcomes = samples.map((sample) => sample.passed);
  const passes = outcomes.filter(Boolean).length;
  const allSamples = result.samples;
  return {
    key: result.caseKey,
    category: result.category,
    name: result.name,
    level: result.level,
    type: result.type,
    instruction: result.instruction,
    heldOut: result.heldOut,
    inherited: false,
    measuredAt,
    samples: outcomes.length,
    passes,
    rate: outcomes.length === 0 ? null : passes / outcomes.length,
    outcomes,
    flaky: isFlaky(outcomes),
    status: statusOf(outcomes.length, passes),
    costUsd: allSamples.reduce((sum, sample) => sum + (sample.costUsd ?? 0), 0),
    durationSeconds: allSamples.reduce((sum, sample) => sum + sample.durationMs, 0) / 1000,
    pairedControl: result.pairedControl,
  };
}

function inheritedCase(key: string, entry: BaselineCaseEntry): ReportCase {
  return {
    key,
    category: entry.category,
    name: entry.name,
    level: entry.level,
    type: entry.type,
    instruction: entry.instruction,
    heldOut: entry.heldOut,
    inherited: true,
    measuredAt: entry.measuredAt,
    samples: entry.samples,
    passes: entry.passes,
    rate: entry.samples === 0 ? null : entry.passes / entry.samples,
    outcomes: entry.sampleOutcomes,
    flaky: isFlaky(entry.sampleOutcomes),
    status: statusOf(entry.samples, entry.passes),
    costUsd: entry.costUsd,
    durationSeconds: 0,
  };
}

export function mergeSuite(
  results: CaseRunResult[],
  measuredAt: string,
  partial: boolean,
  profileBaseline?: Baseline,
): ReportCase[] {
  const measured = results.map((result) => measuredCase(result, measuredAt));
  if (!partial || !profileBaseline) return measured;
  const measuredKeys = new Set(measured.map((reportCase) => reportCase.key));
  const inherited = Object.entries(profileBaseline.cases)
    .filter(([key]) => !measuredKeys.has(key))
    .map(([key, entry]) => inheritedCase(key, entry));
  return [...measured, ...inherited];
}

export function aggregateRate(baseline: Baseline | undefined): number | null {
  if (!baseline) return null;
  const entries = Object.values(baseline.cases);
  const samples = entries.reduce((sum, entry) => sum + entry.samples, 0);
  if (samples === 0) return null;
  return entries.reduce((sum, entry) => sum + entry.passes, 0) / samples;
}
