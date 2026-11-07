import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evaluateCommandChecks } from "./commandChecks.js";
import { evaluateGeneratedFiles, stampedPattern } from "./generatedFiles.js";
import { evaluateSessionUsage } from "./sessionUsage.js";
import { evaluateTextAssertions } from "./text.js";

const none = { equals: [], contains: [], notContains: [], regex: [], notRegex: [] };

describe("text assertions", () => {
  it("compares equals trimmed and case-insensitive against any entry", () => {
    expect(evaluateTextAssertions({ ...none, equals: ["x", "sim"] }, "  SIM \n")[0]?.passed).toBe(true);
    expect(evaluateTextAssertions({ ...none, equals: ["x"] }, "sim")[0]?.passed).toBe(false);
  });
  it("handles contains, notContains and regex", () => {
    const outcomes = evaluateTextAssertions(
      { ...none, contains: ["OLÁ"], notContains: ["tchau"], regex: ["^o\\w+"], notRegex: ["zzz", "ol"] },
      "olá mundo",
    );
    expect(outcomes.map((outcome) => outcome.passed)).toEqual([true, true, true, true, false]);
  });
  it("fails an invalid regex instead of throwing", () => {
    expect(evaluateTextAssertions({ ...none, regex: ["("] }, "a")[0]?.passed).toBe(false);
  });
});

describe("session usage", () => {
  it("matches MCP tools by short name", () => {
    const transcript = { skillsUsed: ["Deploy"], toolsUsed: ["mcp__server__lookup", "Read"], commandsRun: [] };
    const outcomes = evaluateSessionUsage(
      {
        skillsUsed: ["deploy"],
        skillsForbidden: ["x"],
        toolsUsed: ["lookup"],
        toolsForbidden: ["Read"],
        commandsRun: [],
        commandsRunForbidden: [],
      },
      transcript,
    );
    expect(outcomes.map((outcome) => outcome.passed)).toEqual([true, true, true, false]);
  });

  it("checks fragments of the shell commands the session ran", () => {
    const transcript = {
      skillsUsed: [],
      toolsUsed: ["Bash"],
      commandsRun: ["git add src/parser.py", "git commit --all -m wip"],
    };
    const outcomes = evaluateSessionUsage(
      {
        skillsUsed: [],
        skillsForbidden: [],
        toolsUsed: [],
        toolsForbidden: [],
        commandsRun: ["git add src/parser.py", "pytest"],
        commandsRunForbidden: ["commit --all"],
      },
      transcript,
    );
    expect(outcomes.map((outcome) => outcome.passed)).toEqual([true, false, false]);
    expect(outcomes[2]?.message).toContain("commit --all");
  });
});

describe("generated files", () => {
  it("matches stamped names and reports where a file landed", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "generated-"));
    await mkdir(path.join(directory, "out"));
    await writeFile(path.join(directory, "out", "report-20261107.md"), "x");
    await writeFile(path.join(directory, "elsewhere-1.txt"), "x");
    expect(stampedPattern("out/report-2026-11-07.md")).toBe("out/report-*-*-*.md");
    const outcomes = evaluateGeneratedFiles(
      ["out/report-20250101.md", "out/elsewhere-9.txt", "out/none.md"],
      directory,
    );
    expect(outcomes[0]?.passed).toBe(true);
    expect(outcomes[1]?.passed).toBe(false);
    expect(outcomes[1]?.message).toContain("elsewhere-1.txt");
    expect(outcomes[2]?.passed).toBe(false);
  });
});

describe("command checks", () => {
  it("checks per-line regex, env and exit code", async () => {
    const context = { cwd: os.tmpdir(), environment: { GREETING: "oi" }, timeoutMs: 5000 };
    const outcomes = await evaluateCommandChecks(
      [
        { run: "echo a; echo $GREETING", regex: "^oi$" },
        { run: "echo bad >&2; exit 3" },
        { run: "echo ok", notRegex: "ok" },
      ],
      context,
    );
    expect(outcomes.map((outcome) => outcome.passed)).toEqual([true, false, false]);
    expect(outcomes[1]?.message).toContain("bad");
  });
});
