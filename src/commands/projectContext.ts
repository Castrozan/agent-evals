import { loadCases } from "../cases/index.js";
import { findRepositoryRoot, loadProjectConfig } from "../configuration/index.js";
import type { EvalCase } from "../domain/cases.js";
import type { ProjectConfig } from "../domain/project.js";

export interface ProjectContext {
  root: string;
  config: ProjectConfig;
  cases: EvalCase[];
}

export function loadProjectContext(workingDirectory = process.cwd()): ProjectContext {
  const root = findRepositoryRoot(workingDirectory);
  const config = loadProjectConfig(root);
  return { root, config, cases: loadCases(config) };
}
