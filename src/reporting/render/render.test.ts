import { describe, expect, it } from "vitest";
import { baselineOf, caseResult, config, passingVerdict, runOf } from "../__fixtures__/reportFixtures.js";
import { buildReportDocument } from "../document/buildReportDocument.js";
import { renderBadge } from "./badge.js";
import { renderHtml } from "./html.js";
import { renderTerminalSummary } from "./terminalSummary.js";

const hostile = '<img src=x onerror="alert(1)">';
const document = buildReportDocument({
  config,
  run: runOf([caseResult(hostile, [true, false], { caseKey: `cat/${hostile}`, heldOut: true })], {
    project: `p"<${hostile}`,
    leakedSkills: ["s"],
  }),
  profileBaseline: baselineOf([]),
  verdict: passingVerdict,
  coverage: [{ artifact: { kind: "instruction", path: `a/${hostile}.md`, name: "n" }, coveredBy: [`cat/${hostile}`] }],
  pendingCaseKeys: [],
});

describe("renderers", () => {
  it("escapes every interpolated value and stays self-contained", () => {
    const html = renderHtml(document);
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img");
    expect(html).toContain("prefers-color-scheme:dark");
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).toContain("medição não isolada");
    expect(html).toContain("juiz nunca calibrado");
    expect(html).toContain("reservado");
  });

  it("colors the badge by verdict and greys invalid", () => {
    expect(renderBadge(document)).toContain("#2da44e");
    const invalid = { ...document, header: { ...document.header, status: "invalid" as const, rate: null } };
    expect(renderBadge(invalid)).toContain("#8c959f");
    expect(renderBadge(invalid)).not.toContain("%");
  });

  it("summarizes in Portuguese", () => {
    const summary = renderTerminalSummary(document);
    expect(summary).toContain("Taxa por amostra: 50,0%");
    expect(summary).toContain("Aviso: juiz nunca calibrado");
  });
});
