import { globSync } from "tinyglobby";
import { ConfigurationError } from "../configuration/aliasNormalization.js";
import { ignoredGlobs } from "../configuration/ignoredPaths.js";
import type { EnvironmentKind } from "../../domain/cases.js";
import type { ProjectConfig } from "../../domain/project.js";

export interface CaseFileCandidate {
  relativePath: string;
  environmentKind?: EnvironmentKind;
}

function expand(config: ProjectConfig, patterns: string[]): string[] {
  if (patterns.length === 0) return [];
  return globSync(patterns, {
    cwd: config.root,
    ignore: ignoredGlobs(config),
    onlyFiles: true,
  }).filter((file) => /\.ya?ml$/.test(file));
}

export function findCaseFiles(config: ProjectConfig): CaseFileCandidate[] {
  const kindByFile = new Map<string, EnvironmentKind | undefined>();
  for (const file of expand(config, config.casePatterns.any)) kindByFile.set(file, undefined);
  const kinds = Object.entries(config.casePatterns.byKind) as [EnvironmentKind, string[]][];
  for (const [kind, patterns] of kinds) {
    for (const file of expand(config, patterns)) {
      const previous = kindByFile.get(file);
      if (previous !== undefined && previous !== kind) {
        throw new ConfigurationError(
          `${file}: o arquivo casa com os padrões de dois tipos de ambiente (${previous} e ${kind})`,
        );
      }
      kindByFile.set(file, kind);
    }
  }
  return [...kindByFile.entries()]
    .map(([relativePath, environmentKind]) => ({ relativePath, environmentKind }))
    .sort((left, right) => (left.relativePath < right.relativePath ? -1 : 1));
}
