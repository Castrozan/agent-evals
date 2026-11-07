import type { Baseline, BaselineCaseEntry, RegressionFinding } from "../domain/baseline.js";
import { isFlaky } from "../statistics/proportions.js";
import { exactMcNemar, isSignificantDecline } from "../statistics/significance.js";
import { formatPercent, entryPasses, pooledRate } from "./rates.js";

const SIGNIFICANCE_LEVEL = 0.05;

function releaseLine(version: string | undefined): string | undefined {
  return version?.split(".").slice(0, 2).join(".");
}

export function incompatibleInstruments(current: Baseline, previous: Baseline): string | undefined {
  if (current.measurementContract !== previous.measurementContract) {
    return `contrato de medição diferente (${previous.measurementContract} para ${current.measurementContract})`;
  }
  if (releaseLine(current.instrument?.promptfoo) !== releaseLine(previous.instrument?.promptfoo)) {
    return "linha de versão do promptfoo diferente";
  }
  const sdkNames = new Set([
    ...Object.keys(current.instrument?.sdks ?? {}),
    ...Object.keys(previous.instrument?.sdks ?? {}),
  ]);
  for (const sdk of [...sdkNames].sort()) {
    if (releaseLine(current.instrument?.sdks?.[sdk]) !== releaseLine(previous.instrument?.sdks?.[sdk])) {
      return `linha de versão do SDK ${sdk} diferente`;
    }
  }
  return undefined;
}

function hasOutcomes(entry: BaselineCaseEntry): boolean {
  return Array.isArray(entry.sampleOutcomes) && entry.sampleOutcomes.length > 0;
}

function aggregateFinding(
  shared: readonly (readonly [string, BaselineCaseEntry, BaselineCaseEntry])[],
  maxDrop: number,
): RegressionFinding {
  const drop =
    pooledRate(shared.map(([, before]) => before)).rate - pooledRate(shared.map(([, , after]) => after)).rate;
  return {
    fell: shared.filter(([, before, after]) => entryPasses(before) && !entryPasses(after)).map(([key]) => key),
    fellButFlaky: [],
    rose: shared.filter(([, before, after]) => !entryPasses(before) && entryPasses(after)).map(([key]) => key),
    pValue: 1,
    significant: drop > maxDrop,
    method: "aggregate",
  };
}

export function findRegression(current: Baseline, previous: Baseline, maxDrop: number): RegressionFinding | undefined {
  const shared = Object.entries(current.cases).flatMap(([key, after]) => {
    const before = previous.cases[key];
    return before === undefined ? [] : [[key, before, after] as const];
  });
  if (shared.length === 0) return undefined;
  if (!shared.some(([, before]) => hasOutcomes(before))) return aggregateFinding(shared, maxDrop);
  const fell: string[] = [];
  const fellButFlaky: string[] = [];
  const rose: string[] = [];
  for (const [key, before, after] of shared) {
    if (entryPasses(before) && !entryPasses(after)) {
      (hasOutcomes(before) && isFlaky(before.sampleOutcomes) ? fellButFlaky : fell).push(key);
    } else if (!entryPasses(before) && entryPasses(after)) rose.push(key);
  }
  const result = exactMcNemar(fell.length, rose.length);
  return {
    fell,
    fellButFlaky,
    rose,
    pValue: result.pValue,
    significant: isSignificantDecline(result, SIGNIFICANCE_LEVEL),
    method: "mcnemar",
  };
}

export function describeRegression(finding: RegressionFinding, maxDrop: number): string {
  const names = [...finding.fell, ...finding.fellButFlaky.map((key) => `${key} (já instável)`)].join(", ");
  if (finding.method === "aggregate") {
    return `Queda agregada acima de ${formatPercent(maxDrop)} em relação à baseline anterior sem resultados por caso: ${names || "sem casos nomeados"}.`;
  }
  return `Regressão significativa contra a baseline anterior (McNemar p=${finding.pValue.toFixed(3)}): ${names}.`;
}
