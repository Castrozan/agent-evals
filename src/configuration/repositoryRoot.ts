import fs from "node:fs";
import path from "node:path";
import { ConfigurationError } from "./aliasNormalization.js";

export const CONFIG_RELATIVE_PATH = path.join("evals", "config.yaml");

function nearestAncestor(startDirectory: string, marker: string): string | undefined {
  let current = path.resolve(startDirectory);
  for (;;) {
    if (fs.existsSync(path.join(current, marker))) return current;
    const parent = path.dirname(current);
    if (parent === current) return undefined;
    current = parent;
  }
}

export function findRepositoryRoot(startDirectory: string): string {
  const root = nearestAncestor(startDirectory, CONFIG_RELATIVE_PATH) ?? nearestAncestor(startDirectory, ".git");
  if (root === undefined) {
    throw new ConfigurationError(
      `nenhuma raiz de repositório encontrada a partir de ${startDirectory}: faltam evals/config.yaml e .git`,
    );
  }
  return root;
}

export const CONFIG_ENVIRONMENT_VARIABLE = "AGENT_EVALS_CONFIG";

export interface ProjectLocation {
  root: string;
  configPath: string;
}

export function resolveProjectLocation(
  startDirectory: string,
  environment: NodeJS.ProcessEnv = process.env,
): ProjectLocation {
  const declaredConfig = environment[CONFIG_ENVIRONMENT_VARIABLE];
  if (!declaredConfig) {
    const root = findRepositoryRoot(startDirectory);
    return { root, configPath: path.join(root, CONFIG_RELATIVE_PATH) };
  }
  const configPath = path.resolve(startDirectory, declaredConfig);
  const root = nearestAncestor(path.dirname(configPath), ".git");
  if (root === undefined) {
    throw new ConfigurationError(
      `${CONFIG_ENVIRONMENT_VARIABLE} aponta ${configPath}, que não está num repositório git`,
    );
  }
  return { root, configPath };
}
