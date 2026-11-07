import path from "node:path";
import { globSync } from "tinyglobby";
import type { DiscoveredArtifact } from "../domain/artifacts.js";

const STRUCTURAL_INSTRUCTION_GLOBS = ["**/SKILL.md", "**/commands/*.md", "**/workflows/*.md", "**/agents/*.md"];

function instructionName(relativePath: string): string {
  const basename = path.posix.basename(relativePath);
  if (basename === "SKILL.md") return path.posix.basename(path.posix.dirname(relativePath));
  return basename.replace(/\.md$/, "");
}

export function discoverInstructions(root: string, entryPatterns: string[], ignore: string[]): DiscoveredArtifact[] {
  const structural = globSync(STRUCTURAL_INSTRUCTION_GLOBS, { cwd: root, ignore });
  const entries = entryPatterns.length === 0 ? [] : globSync(entryPatterns, { cwd: root, ignore });
  return [...new Set([...entries, ...structural])].sort().map((relativePath) => ({
    kind: "instruction" as const,
    path: relativePath,
    name: instructionName(relativePath),
  }));
}
