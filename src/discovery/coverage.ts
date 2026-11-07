import path from "node:path";
import picomatch from "picomatch";
import { caseKey, type CliCase, type EvalCase, type InstructionCase } from "../domain/cases.js";
import type { CoverageEntry, DiscoveredArtifact } from "../domain/artifacts.js";

function stripCurrentDirectory(value: string): string {
  return path.posix.normalize(value);
}

function coversInstruction(evalCase: InstructionCase, artifactPath: string): boolean {
  const patterns = [evalCase.instruction, ...evalCase.extraInstructions].filter(
    (pattern): pattern is string => pattern !== undefined && pattern !== "",
  );
  return patterns.some((pattern) => picomatch.isMatch(artifactPath, stripCurrentDirectory(pattern), { dot: true }));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function coversCommandLineTool(evalCase: CliCase, artifact: DiscoveredArtifact): boolean {
  if (evalCase.command.includes(artifact.path)) return true;
  const nameMention = new RegExp(`(?<![\\w./-])${escapeRegExp(artifact.name)}(?![\\w-])`);
  return nameMention.test(evalCase.command);
}

function covers(evalCase: EvalCase, artifact: DiscoveredArtifact): boolean {
  if (artifact.kind === "instruction") {
    return evalCase.type === "instruction" && coversInstruction(evalCase, artifact.path);
  }
  if (artifact.kind === "cli") {
    return evalCase.type === "cli" && coversCommandLineTool(evalCase, artifact);
  }
  return evalCase.type === "mcp" && evalCase.server.name === artifact.name;
}

export function computeCoverage(artifacts: DiscoveredArtifact[], cases: EvalCase[]): CoverageEntry[] {
  const activeCases = cases.filter((evalCase) => !evalCase.pending);
  return artifacts.map((artifact) => ({
    artifact,
    coveredBy: activeCases.filter((evalCase) => covers(evalCase, artifact)).map(caseKey),
  }));
}
