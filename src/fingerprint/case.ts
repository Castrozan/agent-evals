import path from "node:path";
import type { EvalCase } from "../domain/cases.js";
import { canonicalJson, sha256Hex } from "./canonical.js";
import { hashPath } from "./files.js";
import { expandPatterns, instructionFilesOf, normalizeRelativePath } from "./instructionPaths.js";

function stagedTreePaths(evalCase: EvalCase): string[] {
  if (evalCase.type === "mcp" || evalCase.environment === undefined) return [];
  const layerSources = evalCase.environment.layers.flatMap((layer) => (layer.from === undefined ? [] : [layer.from]));
  const pluginCopies = evalCase.environment.plugins.flatMap((plugin) => plugin.copy);
  return [...layerSources, ...pluginCopies];
}

function judgeReferencePaths(evalCase: EvalCase): string[] {
  if (evalCase.type === "mcp") return [];
  return evalCase.assertions.judgeOnCommand.flatMap((judged) =>
    judged.reference === undefined ? [] : [judged.reference],
  );
}

function hashRelativePaths(root: string, relativePaths: readonly string[]): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const relative of relativePaths) hashes[relative] = hashPath(path.join(root, relative));
  return hashes;
}

export function caseFingerprint(evalCase: EvalCase, root: string): string {
  const { sourceFile: _sourceFile, ...definition } = evalCase;
  const content = {
    definition,
    instructionFiles: hashRelativePaths(root, instructionFilesOf(evalCase, root)),
    trees: hashRelativePaths(root, expandPatterns(root, stagedTreePaths(evalCase))),
    references: hashRelativePaths(root, judgeReferencePaths(evalCase).map(normalizeRelativePath)),
  };
  return sha256Hex(canonicalJson(content));
}
