import type { Baseline, BaselineCaseEntry } from "../../domain/baseline.js";
import { exactMcNemar, isSignificantDecline, mannWhitney, median } from "../../evidence/statistics/significance.js";

export interface MetricComparison {
  medianA: number;
  medianB: number;
  deltaPercent: number | undefined;
  pValue: number;
}

export interface CaseComparison {
  caseKey: string;
  passedA: number;
  samplesA: number;
  passedB: number;
  samplesB: number;
  tokens: MetricComparison;
  toolOutput: MetricComparison;
  costA: number;
  costB: number;
  costDeltaPercent: number | undefined;
}

export interface VariantComparison {
  labelA: string;
  labelB: string;
  cases: CaseComparison[];
  onlyInA: string[];
  onlyInB: string[];
  totals: {
    passedA: number;
    samplesA: number;
    passedB: number;
    samplesB: number;
    costA: number;
    costB: number;
    costDeltaPercent: number | undefined;
  };
  regression: { fell: string[]; rose: string[]; pValue: number; significant: boolean };
}

export function percentDelta(from: number, to: number): number | undefined {
  return from === 0 ? undefined : ((to - from) / from) * 100;
}

function compareMetric(valuesA: readonly number[], valuesB: readonly number[]): MetricComparison {
  const medianA = median(valuesA);
  const medianB = median(valuesB);
  return {
    medianA,
    medianB,
    deltaPercent: percentDelta(medianA, medianB),
    pValue: mannWhitney(valuesA, valuesB).pValue,
  };
}

function passesMajority(entry: BaselineCaseEntry): boolean {
  return entry.samples > 0 && entry.passes / entry.samples >= 0.5;
}

function compareCase(caseKey: string, entryA: BaselineCaseEntry, entryB: BaselineCaseEntry): CaseComparison {
  return {
    caseKey,
    passedA: entryA.passes,
    samplesA: entryA.samples,
    passedB: entryB.passes,
    samplesB: entryB.samples,
    tokens: compareMetric(entryA.tokenTotals, entryB.tokenTotals),
    toolOutput: compareMetric(entryA.toolOutputCharacters, entryB.toolOutputCharacters),
    costA: entryA.costUsd,
    costB: entryB.costUsd,
    costDeltaPercent: percentDelta(entryA.costUsd, entryB.costUsd),
  };
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function compareVariants(baselineA: Baseline, baselineB: Baseline): VariantComparison {
  const keysA = Object.keys(baselineA.cases).sort();
  const sharedKeys = keysA.filter((key) => baselineB.cases[key] !== undefined);
  const cases = sharedKeys.map((key) => compareCase(key, baselineA.cases[key]!, baselineB.cases[key]!));
  const fell = sharedKeys.filter(
    (key) => passesMajority(baselineA.cases[key]!) && !passesMajority(baselineB.cases[key]!),
  );
  const rose = sharedKeys.filter(
    (key) => !passesMajority(baselineA.cases[key]!) && passesMajority(baselineB.cases[key]!),
  );
  const mcnemar = exactMcNemar(fell.length, rose.length);
  const costA = sum(cases.map((entry) => entry.costA));
  const costB = sum(cases.map((entry) => entry.costB));
  return {
    labelA: baselineA.variant ?? "base",
    labelB: baselineB.variant ?? "base",
    cases,
    onlyInA: keysA.filter((key) => baselineB.cases[key] === undefined),
    onlyInB: Object.keys(baselineB.cases)
      .sort()
      .filter((key) => baselineA.cases[key] === undefined),
    totals: {
      passedA: sum(cases.map((entry) => entry.passedA)),
      samplesA: sum(cases.map((entry) => entry.samplesA)),
      passedB: sum(cases.map((entry) => entry.passedB)),
      samplesB: sum(cases.map((entry) => entry.samplesB)),
      costA,
      costB,
      costDeltaPercent: percentDelta(costA, costB),
    },
    regression: { fell, rose, pValue: mcnemar.pValue, significant: isSignificantDecline(mcnemar) },
  };
}

export function compareExitCode(comparison: VariantComparison): number {
  return comparison.regression.significant ? 1 : 0;
}

export function missingVariantMessage(variant: string): string {
  return `Baseline da variante "${variant}" não encontrada: registre com agent-evals baseline --variante ${variant} --rodar.`;
}
