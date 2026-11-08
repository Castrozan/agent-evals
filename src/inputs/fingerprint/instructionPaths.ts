import { globSync, isDynamicPattern } from "tinyglobby";
import type { EvalCase } from "../../domain/cases.js";

export function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function expandPatterns(root: string, patterns: readonly string[]): string[] {
  const expanded = new Set<string>();
  for (const pattern of patterns.map(normalizeRelativePath)) {
    if (!isDynamicPattern(pattern)) {
      expanded.add(pattern);
      continue;
    }
    for (const match of globSync(pattern, { cwd: root, dot: true })) expanded.add(normalizeRelativePath(match));
  }
  return [...expanded].sort();
}

export function instructionPatterns(evalCase: EvalCase): string[] {
  if (evalCase.type !== "instruction") return [];
  return [...(evalCase.instruction === undefined ? [] : [evalCase.instruction]), ...evalCase.extraInstructions];
}

export function instructionFilesOf(evalCase: EvalCase, root: string): string[] {
  return expandPatterns(root, instructionPatterns(evalCase));
}
