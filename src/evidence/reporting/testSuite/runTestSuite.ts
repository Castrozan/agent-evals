import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestSuiteCard } from "../../../domain/artifacts.js";
import type { TestSuiteDeclaration } from "../../../domain/project.js";
import { parseCountPattern } from "./countPattern.js";
import { parseJunit, type SuiteCounts } from "./junit.js";

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

async function readCounts(
  declaration: TestSuiteDeclaration,
  root: string,
  output: string,
): Promise<SuiteCounts | undefined> {
  if (declaration.junitPath) {
    const xml = await fs.readFile(path.resolve(root, declaration.junitPath), "utf8").catch(() => undefined);
    const counts = xml === undefined ? undefined : parseJunit(xml);
    if (counts) return counts;
  }
  return declaration.countPattern ? parseCountPattern(declaration.countPattern, output) : undefined;
}

export async function runTestSuite(
  declaration: TestSuiteDeclaration,
  root: string,
  commit?: string,
): Promise<TestSuiteRun> {
  const ranAt = new Date().toISOString();
  const result = await runCommand(declaration.command, root);
  const counts = await readCounts(declaration, root, result.output);
  const card: TestSuiteCard = {
    label: declaration.label,
    ranAt,
    commit,
    exitCode: result.exitCode,
    tests: counts?.tests,
    failures: counts?.failures,
    errors: counts?.errors,
    skipped: counts?.skipped,
    durationSeconds: counts?.durationSeconds ?? result.durationSeconds,
  };
  return { card: JSON.parse(JSON.stringify(card)) as TestSuiteCard, output: result.output };
}
