import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type { ProjectConfig } from "../domain/project.js";
import { ConfigurationError, normalizeValue } from "./aliasNormalization.js";
import { projectConfigShape } from "./projectConfigKeys.js";
import { projectConfigSchema, toProjectConfig } from "./projectConfigSchema.js";
import { CONFIG_RELATIVE_PATH } from "./repositoryRoot.js";
import { toConfigurationError } from "./zodIssues.js";

export function loadProjectConfig(root: string): ProjectConfig {
  const configPath = path.join(root, CONFIG_RELATIVE_PATH);
  const fallbackName = path.basename(root);
  const source = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : undefined;
  let document: unknown = {};
  if (source !== undefined) {
    try {
      document = parse(source) ?? {};
    } catch (error) {
      throw new ConfigurationError(`${CONFIG_RELATIVE_PATH}: YAML inválido: ${(error as Error).message}`);
    }
  }
  if (typeof document !== "object" || Array.isArray(document) || document === null) {
    throw new ConfigurationError(`${CONFIG_RELATIVE_PATH}: o conteúdo deve ser um mapa de chaves`);
  }
  const normalized = normalizeValue(document, projectConfigShape, [], CONFIG_RELATIVE_PATH);
  const result = projectConfigSchema.safeParse(normalized);
  if (!result.success) {
    throw toConfigurationError(result.error, projectConfigShape, CONFIG_RELATIVE_PATH);
  }
  return toProjectConfig(result.data, root, source === undefined ? undefined : configPath, fallbackName);
}
