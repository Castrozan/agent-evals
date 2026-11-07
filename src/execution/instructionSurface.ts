import { readFileSync } from "node:fs";
import path from "node:path";
import { expandPatterns } from "../fingerprint/instructionPaths.js";
import type { InstructionCase } from "../domain/cases.js";
import { readFrontmatter } from "../instructions/frontmatter.js";

export function stripFrontmatter(content: string): string {
  const lines = content.split("\n");
  const frontmatter = readFrontmatter(lines);
  return (frontmatter === undefined ? content : lines.slice(frontmatter.endLine).join("\n")).trim();
}

export function hasInstructionSurface(evalCase: InstructionCase): boolean {
  return (
    evalCase.instruction !== undefined || evalCase.extraInstructions.length > 0 || evalCase.systemPrompt !== undefined
  );
}

export function withoutInstructionSurface(evalCase: InstructionCase): InstructionCase {
  return { ...evalCase, instruction: undefined, extraInstructions: [], systemPrompt: undefined };
}

export function buildUnitSystemPrompt(evalCase: InstructionCase, sourceRoot: string): string | undefined {
  const patterns = [
    ...(evalCase.instruction === undefined ? [] : [evalCase.instruction]),
    ...evalCase.extraInstructions,
  ];
  const bodies = expandPatterns(sourceRoot, patterns).map((file) =>
    stripFrontmatter(readFileSync(path.join(sourceRoot, file), "utf8")),
  );
  const parts = [...bodies, ...(evalCase.systemPrompt === undefined ? [] : [evalCase.systemPrompt])].filter(
    (part) => part !== "",
  );
  return parts.length === 0 ? undefined : parts.join("\n\n");
}
