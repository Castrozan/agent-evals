import { describe, expect, it } from "vitest";
import { agreementMetrics } from "./agreement.js";
import { headroomExceedsNoise, isFlaky, noiseFloor, passAtK, wilsonInterval } from "./proportions.js";
import { exactMcNemar, isSignificantDecline, mannWhitney, median } from "./significance.js";

describe("proportions", () => {
  it("brackets nine of ten with the Wilson interval", () => {
    const estimate = wilsonInterval(9, 10);
    expect(estimate.rate).toBe(0.9);
    expect(estimate.lower).toBeCloseTo(0.5958, 3);
    expect(estimate.upper).toBeCloseTo(0.9821, 3);
  });

  it("estimates pass@k without replacement", () => {
    expect(passAtK(10, 5, 1)).toBeCloseTo(0.5);
    expect(passAtK(3, 1, 3)).toBe(1);
    expect(passAtK(3, 0, 2)).toBe(0);
  });

  it("flags mixed outcomes as flaky", () => {
    expect(isFlaky([true, false])).toBe(true);
    expect(isFlaky([true, true])).toBe(false);
  });

  it("compares headroom with the noise floor", () => {
    expect(noiseFloor(47, 3)).toBeCloseTo(0.0842, 3);
    expect(headroomExceedsNoise(0.972, 47, 3)).toBe(false);
    expect(headroomExceedsNoise(0.7, 47, 3)).toBe(true);
  });
});

describe("significance", () => {
  it("computes the exact two-sided McNemar p-value", () => {
    expect(exactMcNemar(5, 0).pValue).toBeCloseTo(0.0625);
    expect(exactMcNemar(0, 0).pValue).toBe(1);
    expect(isSignificantDecline(exactMcNemar(7, 0))).toBe(true);
    expect(isSignificantDecline(exactMcNemar(0, 7))).toBe(false);
  });

  it("runs the exact Mann-Whitney permutation test on small samples", () => {
    const result = mannWhitney([1, 2, 3], [4, 5, 6]);
    expect(result.u).toBe(0);
    expect(result.exact).toBe(true);
    expect(result.pValue).toBeCloseTo(0.1);
  });

  it("takes the median of even and odd samples", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
});

describe("agreement", () => {
  it("gives a constant PASS judge zero kappa despite high accuracy", () => {
    const verdicts = [
      ...Array(8).fill({ expected: true, actual: true }),
      ...Array(2).fill({ expected: false, actual: true }),
    ];
    const metrics = agreementMetrics(verdicts);
    expect(metrics.accuracy).toBe(0.8);
    expect(metrics.kappa).toBe(0);
  });

  it("gives perfect agreement kappa one", () => {
    expect(
      agreementMetrics([
        { expected: true, actual: true },
        { expected: false, actual: false },
      ]).kappa,
    ).toBe(1);
  });
});
