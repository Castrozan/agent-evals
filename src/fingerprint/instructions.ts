import path from "node:path";
import type { EvalCase } from "../domain/cases.js";
import { hashPath } from "./files.js";
import { instructionFilesOf } from "./instructionPaths.js";

export function instructionFingerprints(cases: readonly EvalCase[], root: string): Record<string, string> {
  const fingerprints: Record<string, string> = {};
  for (const evalCase of cases) {
    for (const file of instructionFilesOf(evalCase, root)) fingerprints[file] = hashPath(path.join(root, file));
  }
  return Object.fromEntries(Object.entries(fingerprints).sort(([left], [right]) => left.localeCompare(right)));
}
