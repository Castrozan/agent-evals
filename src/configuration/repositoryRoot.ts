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
