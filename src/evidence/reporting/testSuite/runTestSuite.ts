import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { glob } from "tinyglobby";
import type { TestSuiteCard } from "../../../domain/artifacts.js";
import type { TestSuiteDeclaration } from "../../../domain/project.js";
import { parseCountPattern } from "./countPattern.js";
import { addCounts, parseJunit, type SuiteCounts } from "./junit.js";

const OUTPUT_LIMIT = 1_000_000;

export interface TestSuiteRun {
  card: TestSuiteCard;
  output: string;
}

interface CommandResult {
  exitCode: number;
  output: string;
  durationSeconds: number;
}

function runCommand(command: string, root: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const child = spawn(command, { cwd: root, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const collect = (chunk: Buffer) => {
      output = (output + chunk.toString("utf8")).slice(-OUTPUT_LIMIT);
    };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        exitCode: code ?? (signal ? 128 : 1),
        output,
        durationSeconds: (performance.now() - startedAt) / 1000,
      });
    });
  });
}

interface RecordedReports {
  counts?: SuiteCounts;
  fileCount: number;
}

async function readJunitReports(patterns: readonly string[], root: string): Promise<RecordedReports> {
  if (patterns.length === 0) return { fileCount: 0 };
  const files = (await glob([...patterns], { cwd: root, absolute: true, onlyFiles: true })).sort();
  let counts: SuiteCounts | undefined;
  for (const file of files) {
    const fileCounts = parseJunit(await fs.readFile(file, "utf8"));
    if (fileCounts) counts = counts ? addCounts(counts, fileCounts) : fileCounts;
  }
  return { counts, fileCount: files.length };
}

function recordedSuiteExitCode(counts: SuiteCounts | undefined): number {
  if (counts?.tests === undefined) return 1;
  return (counts.failures ?? 0) + (counts.errors ?? 0) > 0 ? 1 : 0;
}

function describeRecordedReports(patterns: readonly string[], reports: RecordedReports): string {
  const totals = reports.counts
    ? `${reports.counts.tests ?? 0} testes, ${reports.counts.failures ?? 0} falhas, ${reports.counts.errors ?? 0} erros`
    : "nenhuma contagem";
  return `${reports.fileCount} relatórios JUnit em ${patterns.join(", ")}: ${totals}\n`;
}

export async function runTestSuite(
  declaration: TestSuiteDeclaration,
  root: string,
  commit?: string,
): Promise<TestSuiteRun> {
  const ranAt = new Date().toISOString();
  const result = declaration.command === undefined ? undefined : await runCommand(declaration.command, root);
  const reports = await readJunitReports(declaration.junitPatterns, root);
  const counts =
    reports.counts ??
    (declaration.countPattern && result ? parseCountPattern(declaration.countPattern, result.output) : undefined);
  const card: TestSuiteCard = {
    label: declaration.label,
    ranAt,
    commit,
    exitCode: result?.exitCode ?? recordedSuiteExitCode(reports.counts),
    tests: counts?.tests,
    failures: counts?.failures,
    errors: counts?.errors,
    skipped: counts?.skipped,
    durationSeconds: counts?.durationSeconds ?? result?.durationSeconds,
  };
  return {
    card: JSON.parse(JSON.stringify(card)) as TestSuiteCard,
    output: result?.output ?? describeRecordedReports(declaration.junitPatterns, reports),
  };
}
