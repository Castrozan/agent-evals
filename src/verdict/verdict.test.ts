import { describe, expect, it } from "vitest";
import { caseKey } from "../domain/cases.js";
import { assessRunValidity } from "./runValidity.js";
import { evaluateVerdict } from "./evaluate.js";
import { renderVerdict } from "./render.js";
import type { VerdictInput } from "./types.js";
import {
  makeBaseline,
  makeCase,
  makeCaseResult,
  makeConfig,
  makeEntry,
  makeRun,
  makeSample,
} from "./__fixtures__/builders.js";

const NOW = new Date("2026-11-07T00:00:00.000Z");
const passing = [true, true, true, true];

function cases(count: number, prefix = "k", outcomes: boolean[] = passing, category = "c") {
  return Array.from({ length: count }, (_, index) => makeEntry(category, `${prefix}${index}`, outcomes));
}

function input(overrides: Partial<VerdictInput> & { entries?: ReturnType<typeof cases> } = {}): VerdictInput {
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

const codes = (verdictInput: VerdictInput) => evaluateVerdict(verdictInput).reasons.map((reason) => reason.code);

describe("evaluateVerdict gates", () => {
  it("passes a healthy baseline", () => {
    const verdict = evaluateVerdict(input());
    expect(verdict.passed).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it("reports a missing baseline", () => {
    expect(codes(input({ baseline: undefined }))).toEqual(["baseline-ausente"]);
  });

  it("fails below the overall floor with per-sample rate", () => {
    const entries = [makeEntry("c", "a", [true, true, true, true]), makeEntry("c", "b", [true, false, false, false])];
    expect(codes(input({ entries }))).toContain("piso-geral");
    const slightlyHigher = [
      makeEntry("c", "a", [true, true, true, true]),
      makeEntry("c", "b", [true, true, false, false]),
    ];
    expect(codes(input({ entries: slightlyHigher }))).not.toContain("piso-geral");
  });

  it("fails a critical category under its floor naming it", () => {
    const entries = [...cases(6, "ok"), makeEntry("crit", "x", [true, true, true, false])];
    const config = makeConfig({
      thresholds: { ...makeConfig().thresholds, criticalCategories: ["crit"] },
    });
    const verdict = evaluateVerdict(input({ entries, config }));
    const reason = verdict.reasons.find((candidate) => candidate.code === "piso-critico");
    expect(reason?.category).toBe("crit");
  });

  it("flags stale baselines, other profiles and legacy baselines without a profile", () => {
    const old = makeBaseline(
      cases(3).map((entry) => ({ ...entry, measuredAt: "2026-09-01T00:00:00.000Z" })),
      {
        profileId: "other",
      },
    );
    expect(codes(input({ baseline: old }))).toEqual(expect.arrayContaining(["baseline-vencida", "perfil-diferente"]));
    const legacy = makeBaseline(cases(3));
    expect(codes(input({ baseline: legacy }))).toEqual([]);
  });

  it("flags required category, insufficient runs, missing and removed cases", () => {
    const entries = [...cases(3), makeEntry("c", "thin", [true])];
    const config = makeConfig({
      thresholds: { ...makeConfig().thresholds, requiredCategories: ["ausente"] },
    });
    const suiteCases = [
      ...entries.filter((entry) => entry.name !== "k0").map((entry) => makeCase("c", entry.name)),
      makeCase("c", "novo"),
      makeCase("c", "pend", { pending: true }),
    ];
    const verdict = evaluateVerdict(input({ entries, config, suiteCases }));
    const byCode = Object.fromEntries(verdict.reasons.map((reason) => [reason.code, reason]));
    expect(byCode["categoria-obrigatoria-ausente"]?.category).toBe("ausente");
    expect(byCode["execucoes-insuficientes"]?.caseKey).toBe("c/thin");
    expect(byCode["caso-sem-resultado"]?.caseKey).toBe("c/novo");
    expect(byCode["caso-removido"]?.caseKey).toBe("c/k0");
  });

  it("names the changed instruction file and its category", () => {
    const entries = cases(3);
    const baseline = makeBaseline(entries, {
      profileId: "canon",
      instructionFingerprints: { "skills/a/SKILL.md": "old", "skills/b/SKILL.md": "same" },
    });
    const suiteCases = entries.map((entry, index) =>
      makeCase("c", entry.name, { instruction: index === 0 ? "skills/a/SKILL.md" : "skills/b/SKILL.md" }),
    );
    const verdict = evaluateVerdict(
      input({
        entries,
        baseline,
        suiteCases,
        instructionFingerprintsNow: { "skills/a/SKILL.md": "new", "skills/b/SKILL.md": "same" },
      }),
    );
    const reasons = verdict.reasons.filter((reason) => reason.code === "instrucao-alterada");
    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toMatchObject({ file: "skills/a/SKILL.md", category: "c" });
  });

  it("adds rubric and instruction format reasons", () => {
    const verdict = evaluateVerdict(
      input({
        rubricViolations: [{ caseKey: "c/k0", message: "sem rubrica" }],
        instructionFormatFailures: [{ file: "SKILL.md", line: 3, rule: "descricao-longa", message: "longa" }],
      }),
    );
    expect(verdict.reasons.map((reason) => reason.code)).toEqual(["rubrica", "formato-instrucoes"]);
    expect(verdict.passed).toBe(false);
  });
});

describe("evaluateVerdict regression", () => {
  const before = (count: number, outcomes: boolean[]) => cases(count, "r", outcomes);
  const fellBy = (count: number, fellCount: number, previousOutcomes = passing) => {
    const previousEntries = before(count, previousOutcomes);
    const currentEntries = previousEntries.map((entry, index) =>
      index < fellCount ? { ...entry, samples: 4, passes: 0, sampleOutcomes: [false, false, false, false] } : entry,
    );
    return { previousEntries, currentEntries };
  };

  it("fails when enough cases fell to be significant", () => {
    const { previousEntries, currentEntries } = fellBy(12, 6);
    const verdict = evaluateVerdict(
      input({
        entries: currentEntries,
        config: makeConfig({ thresholds: { ...makeConfig().thresholds, overallFloor: 0 } }),
        previousBaseline: makeBaseline(previousEntries),
      }),
    );
    expect(verdict.regression).toMatchObject({ method: "mcnemar", significant: true });
    expect(verdict.regression?.fell).toHaveLength(6);
    expect(verdict.reasons.map((reason) => reason.code)).toContain("regressao");
  });

  it("does not fail on a few fallen cases that are not significant", () => {
    const { previousEntries, currentEntries } = fellBy(12, 2);
    const verdict = evaluateVerdict(
      input({
        entries: currentEntries,
        config: makeConfig({ thresholds: { ...makeConfig().thresholds, overallFloor: 0 } }),
        previousBaseline: makeBaseline(previousEntries),
      }),
    );
    expect(verdict.regression?.significant).toBe(false);
    expect(verdict.reasons.map((reason) => reason.code)).not.toContain("regressao");
  });

  it("separates cases that were already flaky and does not count them", () => {
    const { previousEntries, currentEntries } = fellBy(12, 6, [true, true, true, false]);
    const verdict = evaluateVerdict(
      input({
        entries: currentEntries,
        config: makeConfig({ thresholds: { ...makeConfig().thresholds, overallFloor: 0 } }),
        previousBaseline: makeBaseline(previousEntries),
      }),
    );
    expect(verdict.regression?.fell).toEqual([]);
    expect(verdict.regression?.fellButFlaky).toHaveLength(6);
    expect(verdict.regression?.significant).toBe(false);
  });

  it("falls back to the aggregate drop when the previous baseline has no outcomes", () => {
    const previousEntries = before(4, passing).map(({ sampleOutcomes: _outcomes, ...rest }) => rest) as ReturnType<
      typeof cases
    >;
    const currentEntries = before(4, [true, true, true, false]);
    const verdict = evaluateVerdict(
      input({
        entries: currentEntries,
        previousBaseline: makeBaseline(previousEntries),
      }),
    );
    expect(verdict.regression).toMatchObject({ method: "aggregate", significant: true });
  });

  it("skips regression with a notice when the contract or release lines differ", () => {
    const { previousEntries, currentEntries } = fellBy(12, 6);
    const base = {
      entries: currentEntries,
      config: makeConfig({ thresholds: { ...makeConfig().thresholds, overallFloor: 0 } }),
    };
    const contract = evaluateVerdict(
      input({ ...base, previousBaseline: makeBaseline(previousEntries, { measurementContract: 0 }) }),
    );
    expect(contract.regression).toBeUndefined();
    expect(contract.notices.join(" ")).toContain("contrato");
    const promptfoo = evaluateVerdict(
      input({
        ...base,
        previousBaseline: makeBaseline(previousEntries, {
          instrument: {
            agentEvals: "0.1.0",
            measurementContract: 1,
            promptfoo: "0.119.0",
            sdks: { claude: "0.3.319" },
          },
        }),
      }),
    );
    expect(promptfoo.regression).toBeUndefined();
    const sameLines = evaluateVerdict(
      input({
        ...base,
        previousBaseline: makeBaseline(previousEntries, {
          instrument: { agentEvals: "0.1.0", measurementContract: 1, promptfoo: "0.118.9", sdks: { claude: "0.3.1" } },
        }),
      }),
    );
    expect(sameLines.regression?.significant).toBe(true);
    const sdkMinor = evaluateVerdict(
      input({
        ...base,
        previousBaseline: makeBaseline(previousEntries, {
          instrument: { agentEvals: "0.1.0", measurementContract: 1, promptfoo: "0.118.2", sdks: { claude: "0.4.0" } },
        }),
      }),
    );
    expect(sdkMinor.regression).toBeUndefined();
    expect(sdkMinor.notices.join(" ")).toContain("claude");
  });

  it("warns when headroom does not exceed the noise floor", () => {
    const verdict = evaluateVerdict(input({ entries: cases(2, "n", [true, true, true, false]) }));
    expect(verdict.notices.join(" ")).toContain("ruído");
  });
});

describe("run validity and rendering", () => {
  it("marks a run invalid when a model case has no measured sample", () => {
    const failed = makeSample(false, { instrumentFailure: { kind: "timeout", message: "tempo" } });
    const run = makeRun([makeCaseResult("a", [makeSample(true)]), makeCaseResult("b", [failed])]);
    expect(assessRunValidity(run)).toMatchObject({ invalid: true });
    expect(assessRunValidity(run).reason).toContain("c/b");
    const cliOnly = makeRun([makeCaseResult("cli", [], { type: "cli" })]);
    expect(assessRunValidity(cliOnly).invalid).toBe(false);
  });

  it("renders reasons in Portuguese", () => {
    const text = renderVerdict(evaluateVerdict(input({ baseline: undefined })));
    expect(text).toContain("Veredito: reprovado");
    expect(text).toContain("[baseline-ausente]");
    expect(caseKey({ category: "a", name: "b" })).toBe("a/b");
  });
});
