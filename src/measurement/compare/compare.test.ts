import { describe, expect, it } from "vitest";
import { makeBaseline, makeEntry } from "../../evidence/verdict/__fixtures__/builders.js";
import { compareExitCode, compareVariants, missingVariantMessage } from "./compare.js";
import { renderComparisonJson, renderComparisonText } from "./render.js";

const names = Array.from({ length: 8 }, (_, index) => `k${index}`);
const sideA = makeBaseline(
  [...names.map((name) => makeEntry("c", name, [true, true, true, true])), makeEntry("c", "only-a", [true])],
  { variant: "a" },
);

describe("compareVariants", () => {
  it("flags a significant a to b regression and exits 1", () => {
    const sideB = makeBaseline(
      [
        ...names.map((name, index) =>
          index < 6
            ? makeEntry("c", name, [false, false, false, false], { tokenTotals: [200, 210, 220, 230], costUsd: 0.1 })
            : makeEntry("c", name, [true, true, true, true]),
        ),
        makeEntry("c", "only-b", [true]),
      ],
      { variant: "b" },
    );
    const comparison = compareVariants(sideA, sideB);
    expect(comparison.regression.significant).toBe(true);
    expect(comparison.regression.fell).toHaveLength(6);
    expect(comparison.onlyInA).toEqual(["c/only-a"]);
    expect(comparison.onlyInB).toEqual(["c/only-b"]);
    const first = comparison.cases.find((entry) => entry.caseKey === "c/k0")!;
    expect(first.tokens).toMatchObject({ medianA: 100, medianB: 215 });
    expect(first.tokens.deltaPercent).toBeCloseTo(115);
    expect(first.tokens.pValue).toBeLessThan(0.05);
    expect(first.costDeltaPercent).toBeCloseTo(150);
    expect(comparison.totals).toMatchObject({ passedA: 32, samplesA: 32, passedB: 8, samplesB: 32 });
    expect(compareExitCode(comparison)).toBe(1);
    expect(renderComparisonText(comparison)).toContain("regrediu em b");
    expect(JSON.parse(renderComparisonJson(comparison)).labelB).toBe("b");
  });

  it("exits 0 when b did not regress and handles zero baselines", () => {
    const sideB = makeBaseline(
      names.map((name) => makeEntry("c", name, [true, true, true, true], { costUsd: 0 })),
      { variant: "b" },
    );
    const zeroA = makeBaseline(
      names.map((name) => makeEntry("c", name, [true, true, true, true], { costUsd: 0 })),
      { variant: "a" },
    );
    const comparison = compareVariants(zeroA, sideB);
    expect(compareExitCode(comparison)).toBe(0);
    expect(comparison.totals.costDeltaPercent).toBeUndefined();
    expect(renderComparisonText(comparison)).toContain("n/d");
  });

  it("names the command that records a missing variant", () => {
    expect(missingVariantMessage("x")).toContain("baseline --variante x --rodar");
  });
});
