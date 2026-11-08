import { globSync } from "tinyglobby";
import type { AssertionOutcome } from "../../domain/results.js";

const IGNORED_DIRECTORIES = ["**/.git/**", "**/node_modules/**"];
const STAMP_RUN = /(?=[0-9a-f]*\d)[0-9a-f]{6,}|\d+/gi;

export function stampedPattern(pattern: string): string {
  const separator = pattern.lastIndexOf("/");
  const directory = pattern.slice(0, separator + 1);
  const basename = pattern.slice(separator + 1);
  return `${directory}${basename.replace(STAMP_RUN, "*")}`;
}

function findMatches(pattern: string, sessionDirectory: string): string[] {
  return globSync(pattern, { cwd: sessionDirectory, dot: true, ignore: IGNORED_DIRECTORIES });
}

function basenameOf(pattern: string): string {
  return pattern.slice(pattern.lastIndexOf("/") + 1);
}

function outcomeFor(pattern: string, sessionDirectory: string): AssertionOutcome {
  const promised = findMatches(pattern, sessionDirectory);
  if (promised.length > 0) return { kind: "generatedFiles", passed: true, message: `Arquivo gerado: ${promised[0]}.` };
  const stamped = findMatches(stampedPattern(pattern), sessionDirectory);
  if (stamped.length > 0) return { kind: "generatedFiles", passed: true, message: `Arquivo gerado: ${stamped[0]}.` };
  const elsewhere = findMatches(`**/${stampedPattern(basenameOf(pattern))}`, sessionDirectory);
  const message =
    elsewhere.length > 0
      ? `Arquivo "${pattern}" não foi gerado no caminho prometido; foi parar em: ${elsewhere.join(", ")}.`
      : `Arquivo "${pattern}" não foi gerado.`;
  return { kind: "generatedFiles", passed: false, message };
}

export function evaluateGeneratedFiles(patterns: readonly string[], sessionDirectory: string): AssertionOutcome[] {
  return patterns.map((pattern) => outcomeFor(pattern, sessionDirectory));
}
