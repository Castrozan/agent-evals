import { selectCases } from "../../cases/index.js";
import { normalizePartition } from "../../configuration/index.js";
import type { Baseline } from "../../domain/baseline.js";
import { caseKey, type EvalCase } from "../../domain/cases.js";
import type { RunSelection } from "../../domain/results.js";
import { caseFingerprint, selectAffectedCases } from "../../fingerprint/index.js";
import type { ProjectContext } from "../projectContext.js";

export interface RunSelectionOptions {
  categoria?: string[];
  caso?: string[];
  afetados?: boolean;
  particao?: string;
}

export function selectRunCases(
  context: ProjectContext,
  options: RunSelectionOptions,
  profileBaseline: Baseline | undefined,
): { cases: EvalCase[]; selection: RunSelection } {
  const partition = options.particao === undefined ? undefined : normalizePartition(options.particao);
  let cases = selectCases(context.cases, { categories: options.categoria, caseNames: options.caso, partition });
  if (options.afetados) {
    const fingerprinted = cases.map((evalCase) => ({
      evalCase,
      caseKey: caseKey(evalCase),
      fingerprint: caseFingerprint(evalCase, context.root),
    }));
    cases = selectAffectedCases(fingerprinted, profileBaseline, new Date(), context.config.thresholds.validityDays).map(
      (candidate) => candidate.evalCase,
    );
  }
  const categories = options.categoria ?? [];
  const caseNames = options.caso ?? [];
  return {
    cases,
    selection: {
      categories,
      cases: caseNames,
      affected: Boolean(options.afetados),
      partition,
      partial: categories.length > 0 || caseNames.length > 0 || Boolean(options.afetados) || partition !== undefined,
    },
  };
}
