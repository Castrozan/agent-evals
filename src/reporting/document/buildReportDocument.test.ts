import { describe, expect, it } from "vitest";
import {
  baselineEntry,
  baselineOf,
  caseResult,
  config,
  passingVerdict,
  runOf,
} from "../__fixtures__/reportFixtures.js";
import { buildReportDocument } from "./buildReportDocument.js";

const coverage = [
  {
    artifact: { kind: "instruction" as const, path: "skills/a/SKILL.md", name: "a" },
    coveredBy: ["cat/one", "cat/two"],
  },
  { artifact: { kind: "cli" as const, path: "bin/x", name: "x" }, coveredBy: ["cat/pend"] },
  { artifact: { kind: "mcp" as const, path: ".mcp.json", name: "m" }, coveredBy: [] },
];

describe("buildReportDocument", () => {
  it("computes per-sample rate, flaky, failures, coverage and calibration warning", () => {
    const document = buildReportDocument({
      config,
      run: runOf([
        caseResult("one", [true, true]),
        caseResult("two", [true, false, false]),
        caseResult("three", [true, false]),
      ]),
      previousBaseline: baselineOf([baselineEntry("two", 0, 2, "2025-12-01T00:00:00Z")]),
      verdict: passingVerdict,
      coverage,
      pendingCaseKeys: ["cat/pend"],
    });
    expect(document.header.rate?.passes).toBe(4);
    expect(document.header.rate?.samples).toBe(7);
    expect(document.header.previousRate).toBe(0);
    expect(document.flaky.map((entry) => entry.key)).toEqual(["cat/three", "cat/two"]);
    expect(document.failures).toHaveLength(1);
    expect(document.failures[0]).toMatchObject({
      key: "cat/two",
      failingSince: "2025-12-01T00:00:00Z",
      input: "pergunta",
    });
    expect(document.failures[0]?.actualOutput).toContain("script");
    expect(document.header.coverage).toEqual([
      { kind: "cli", total: 1, covered: 0 },
      { kind: "instruction", total: 1, covered: 1 },
      { kind: "mcp", total: 1, covered: 0 },
    ]);
    expect(document.uncovered.map((entry) => [entry.path, entry.onlyPending])).toEqual([
      [".mcp.json", false],
      ["bin/x", true],
    ]);
    expect(document.header.calibration).toEqual({ status: "never" });
    expect(document.categories[0]?.groups[0]?.path).toBe("skills/a/SKILL.md");
  });

  it("merges inherited cases on partial runs", () => {
    const document = buildReportDocument({
      config,
      run: runOf([caseResult("one", [true])], {
        selection: { categories: ["cat"], cases: ["one"], affected: false, partial: true },
      }),
      profileBaseline: baselineOf([baselineEntry("one", 0, 1), baselineEntry("old", 1, 4, "2026-01-05T00:00:00Z")]),
      verdict: passingVerdict,
      coverage: [],
      pendingCaseKeys: [],
    });
    expect(document.header.measured).toMatchObject({ measuredCases: 1, inheritedCases: 1, totalCases: 2 });
    expect(document.header.rate).toMatchObject({ passes: 2, samples: 5 });
    const inherited = document.categories[0]?.groups[0]?.cases.find((entry) => entry.inherited);
    expect(inherited?.measuredAt).toBe("2026-01-05T00:00:00Z");
  });

  it("drops rate and verdict on invalid runs and flags noise and isolation", () => {
    const invalid = buildReportDocument({
      config,
      run: runOf([caseResult("one", [])], { invalid: { reason: "sem amostras" }, leakedSkills: ["x"] }),
      verdict: { passed: false, invalid: true, reasons: [{ code: "c", message: "m" }], notices: [] },
      coverage: [],
      pendingCaseKeys: [],
    });
    expect(invalid.header).toMatchObject({ status: "invalid", rate: null, reasons: [] });
    expect(invalid.header.isolation).toEqual({ isolated: false, leakedSkills: ["x"] });
    const noisy = buildReportDocument({
      config,
      run: runOf([caseResult("one", [true, false]), caseResult("two", [true, true])]),
      verdict: passingVerdict,
      coverage: [],
      calibration: { kappa: 0.8, accuracy: 0.9, recordedAt: "2026-01-01T00:00:00Z", stale: true } as never,
      pendingCaseKeys: [],
    });
    expect(noisy.header.noise?.headroomExceedsNoise).toBe(false);
    expect(noisy.header.calibration.status).toBe("stale");
  });
});
