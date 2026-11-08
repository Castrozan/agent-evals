import { describe, expect, it } from "vitest";
import { caseKey } from "../../domain/cases.js";
import { assessRunValidity } from "./runValidity.js";
import { evaluateVerdict } from "./evaluate.js";
import { renderVerdict } from "./render.js";
import {
  makeBaseline,
  makeCase,
  makeCaseResult,
  makeConfig,
  makeEntry,
  makeRun,
  makeSample,
} from "./__fixtures__/builders.js";
import { cases, codes, input } from "./__fixtures__/verdictInput.js";

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
