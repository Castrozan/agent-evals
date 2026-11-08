import { groupBy } from "./groupBy.js";
import type { CoverageEntry } from "../../../domain/artifacts.js";
import { wilsonInterval } from "../../statistics/proportions.js";
import type { KindCoverage, ReportCase, ReportCategory, ReportGroup, ReportUncovered } from "./reportDocument.js";

function rateOf(passes: number, samples: number): number | null {
  return samples === 0 ? null : wilsonInterval(passes, samples).rate;
}

function sumCases(cases: ReportCase[]) {
  return {
    samples: cases.reduce((sum, reportCase) => sum + reportCase.samples, 0),
    passes: cases.reduce((sum, reportCase) => sum + reportCase.passes, 0),
  };
}

export function groupByCategory(cases: ReportCase[], coverage: CoverageEntry[]): ReportCategory[] {
  const artifactByCaseKey = new Map<string, CoverageEntry["artifact"]>();
  const artifactByPath = new Map(coverage.map((entry) => [entry.artifact.path, entry.artifact]));
  for (const entry of coverage) {
    for (const key of entry.coveredBy) if (!artifactByCaseKey.has(key)) artifactByCaseKey.set(key, entry.artifact);
  }
  const casesByCategory = groupBy(cases, (reportCase) => reportCase.category);
  return [...casesByCategory.entries()]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([name, categoryCases]) => {
      const casesByPath = groupBy(
        categoryCases,
        (reportCase) => reportCase.instruction ?? artifactByCaseKey.get(reportCase.key)?.path ?? null,
      );
      const groups: ReportGroup[] = [...casesByPath.entries()]
        .sort(([first], [second]) => (first ?? "￿").localeCompare(second ?? "￿"))
        .map(([path, groupCases]) => {
          const artifact =
            path === null ? undefined : (artifactByPath.get(path) ?? artifactByCaseKey.get(groupCases[0]!.key));
          const totals = sumCases(groupCases);
          return {
            path,
            name: artifact?.name ?? name,
            kind: artifact?.kind ?? null,
            ...totals,
            rate: rateOf(totals.passes, totals.samples),
            cases: [...groupCases].sort((first, second) => first.name.localeCompare(second.name)),
          };
        });
      const totals = sumCases(categoryCases);
      return { name, ...totals, rate: rateOf(totals.passes, totals.samples), groups };
    });
}

export function summarizeCoverage(
  coverage: CoverageEntry[],
  pendingCaseKeys: string[],
): { byKind: KindCoverage[]; uncovered: ReportUncovered[] } {
  const pending = new Set(pendingCaseKeys);
  const uncovered: ReportUncovered[] = [];
  const totals = new Map<ReportUncovered["kind"], KindCoverage>();
  for (const { artifact, coveredBy } of coverage) {
    const summary = totals.get(artifact.kind) ?? { kind: artifact.kind, total: 0, covered: 0 };
    summary.total += 1;
    if (coveredBy.some((key) => !pending.has(key))) summary.covered += 1;
    else
      uncovered.push({
        kind: artifact.kind,
        path: artifact.path,
        name: artifact.name,
        onlyPending: coveredBy.length > 0,
      });
    totals.set(artifact.kind, summary);
  }
  uncovered.sort((first, second) => first.path.localeCompare(second.path));
  return { byKind: [...totals.values()].sort((first, second) => first.kind.localeCompare(second.kind)), uncovered };
}
