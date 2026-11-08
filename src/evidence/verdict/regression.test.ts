import { describe, expect, it } from "vitest";
import { evaluateVerdict } from "./evaluate.js";
import { makeBaseline, makeConfig } from "./__fixtures__/builders.js";
import { cases, input, passing } from "./__fixtures__/verdictInput.js";

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
