import { loadCases } from "../inputs/cases/index.js";
import { loadProjectConfig, resolveProjectLocation } from "../inputs/configuration/index.js";
import type { EvalCase } from "../domain/cases.js";
import type { ProjectConfig } from "../domain/project.js";

export interface ProjectContext {
  root: string;
  config: ProjectConfig;
  cases: EvalCase[];
}

export function loadProjectContext(workingDirectory = process.cwd()): ProjectContext {
  const { root, configPath } = resolveProjectLocation(workingDirectory);
  const config = loadProjectConfig(root, configPath);
  return { root, config, cases: loadCases(config) };
}
