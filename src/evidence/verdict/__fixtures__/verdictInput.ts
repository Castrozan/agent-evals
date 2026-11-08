import { evaluateVerdict } from "../evaluate.js";
import type { VerdictInput } from "../types.js";
import { makeBaseline, makeCase, makeConfig, makeEntry } from "./builders.js";

export const NOW = new Date("2026-11-07T00:00:00.000Z");
export const passing = [true, true, true, true];

export function cases(count: number, prefix = "k", outcomes: boolean[] = passing, category = "c") {
  return Array.from({ length: count }, (_, index) => makeEntry(category, `${prefix}${index}`, outcomes));
}

export function input(overrides: Partial<VerdictInput> & { entries?: ReturnType<typeof cases> } = {}): VerdictInput {
  const entries = overrides.entries ?? cases(3);
  return {
    config: makeConfig(),
    suiteCases: entries.map((entry) => makeCase(entry.category, entry.name)),
    baseline: makeBaseline(entries, { profileId: "canon" }),
    previousBaseline: undefined,
    canonicalProfileId: "canon",
    instructionFingerprintsNow: {},
    now: NOW,
    rubricViolations: [],
    instructionFormatFailures: [],
    ...overrides,
  };
}

export const codes = (verdictInput: VerdictInput) => evaluateVerdict(verdictInput).reasons.map((reason) => reason.code);
