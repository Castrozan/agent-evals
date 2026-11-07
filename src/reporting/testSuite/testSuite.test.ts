import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseCountPattern } from "./countPattern.js";
import { parseJunit } from "./junit.js";
import { runTestSuite } from "./runTestSuite.js";
import { loadTestSuiteCard, saveTestSuiteCard } from "./testSuiteCardFile.js";

describe("junit and count parsing", () => {
  it("reads the root testsuites aggregate", () => {
    expect(
      parseJunit(
        '<testsuites tests="5" failures="1" errors="0" skipped="2" time="1.5"><testsuite tests="5"/></testsuites>',
      ),
    ).toMatchObject({
      tests: 5,
      failures: 1,
      skipped: 2,
      durationSeconds: 1.5,
    });
  });

  it("sums top-level testsuite elements without double counting nested ones", () => {
    const xml = `<testsuites><testsuite tests="2" time="1"><testsuite tests="2"/></testsuite><testsuite tests="3" failures="1" time="2"/></testsuites>`;
    expect(parseJunit(xml)).toMatchObject({ tests: 5, failures: 1, durationSeconds: 3 });
    expect(parseJunit("<nothing/>")).toBeUndefined();
  });

  it("applies the count regex with named groups", () => {
    expect(parseCountPattern("(?<passed>\\d+) passed, (?<failed>\\d+) failed", "x\n8 passed, 2 failed")).toMatchObject({
      tests: 10,
      failures: 2,
    });
    expect(parseCountPattern("(?<passou>\\d+) ok", "3 ok")).toMatchObject({ tests: 3, failures: 0 });
  });
});

describe("runTestSuite", () => {
  it("captures exit code, counts and never stores the command", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "suite-"));
    const run = await runTestSuite(
      {
        command: "echo '4 passed, 1 failed'; exit 3",
        countPattern: "(?<passed>\\d+) passed, (?<failed>\\d+) failed",
        label: "unit",
      },
      root,
      "abc123",
    );
    expect(run.card).toMatchObject({ exitCode: 3, tests: 5, failures: 1, label: "unit", commit: "abc123" });
    const reportPath = path.join(root, "out", "relatorio.html");
    const cardPath = await saveTestSuiteCard(reportPath, run.card);
    expect(path.basename(cardPath)).toBe("testes.json");
    expect(await fs.readFile(cardPath, "utf8")).not.toContain("echo");
    expect(await loadTestSuiteCard(reportPath)).toEqual(run.card);
    expect(await loadTestSuiteCard(path.join(root, "none", "r.html"))).toBeUndefined();
  });

  it("prefers the junit file when present", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "suite-"));
    const run = await runTestSuite(
      { command: `printf '<testsuites tests="7" failures="0" time="2"/>' > j.xml`, junitPath: "j.xml" },
      root,
    );
    expect(run.card).toMatchObject({ exitCode: 0, tests: 7, durationSeconds: 2 });
  });
});
