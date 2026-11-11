import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeConfig, makeRun } from "../../evidence/verdict/__fixtures__/builders.js";
import { reportPathsFor } from "../../evidence/reporting/index.js";
import { lastRunPath } from "../lastRun.js";
import type { ProjectContext } from "../projectContext.js";
import { contextWritingReportTo, exitCodeForRun } from "./runCommand.js";

const context: ProjectContext = { root: "/repo", config: makeConfig(), cases: [] };

describe("contextWritingReportTo", () => {
  it("keeps the configured report path when no override is given", () => {
    expect(contextWritingReportTo(context, undefined)).toBe(context);
  });

  it("moves the report, its JSON, the badge and the last run beside the override", () => {
    const overridden = contextWritingReportTo(context, "/scratch/nightly/relatorio.html").config;
    const paths = reportPathsFor(path.resolve(overridden.root, overridden.reportPath));

    expect(paths.htmlPath).toBe("/scratch/nightly/relatorio.html");
    expect(paths.jsonPath).toBe("/scratch/nightly/relatorio.json");
    expect(paths.badgePath).toBe("/scratch/nightly/badge.svg");
    expect(lastRunPath(overridden)).toBe("/scratch/nightly/execucao.json");
  });

  it("resolves a relative override against the working directory, not the repository root", () => {
    const overridden = contextWritingReportTo(context, "out/relatorio.html").config;

    expect(overridden.reportPath).toBe(path.resolve("out/relatorio.html"));
  });
});

describe("exitCodeForRun", () => {
  it("fails a run whose measurement is invalid", () => {
    expect(exitCodeForRun(makeRun([], { invalid: { reason: "instrumento falhou" } }))).toBe(1);
  });

  it("succeeds for a valid run and for a dry run that records nothing", () => {
    expect(exitCodeForRun(makeRun([]))).toBe(0);
    expect(exitCodeForRun(undefined)).toBe(0);
  });
});
