import fs from "node:fs";
import path from "node:path";
import type { ProjectConfig } from "../domain/project.js";
import type { RunRecord } from "../domain/results.js";
import { reportPathsFor } from "../reporting/index.js";

const LAST_RUN_FILE = "execucao.json";

export function lastRunPath(config: ProjectConfig): string {
  return path.join(reportPathsFor(path.resolve(config.root, config.reportPath)).directory, LAST_RUN_FILE);
}

export function writeLastRun(config: ProjectConfig, run: RunRecord): void {
  const target = lastRunPath(config);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(run, null, 2)}\n`);
}

export function readLastRun(config: ProjectConfig): RunRecord {
  const target = lastRunPath(config);
  if (!fs.existsSync(target)) {
    throw new Error(`nenhuma execução encontrada em ${path.relative(config.root, target)}; rode agent-evals run antes`);
  }
  return JSON.parse(fs.readFileSync(target, "utf8")) as RunRecord;
}
