import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Baseline } from "../../domain/baseline.js";
import { canonicalJson } from "../../inputs/fingerprint/canonical.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBaseline(content: string, filePath: string): Baseline {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Baseline ilegível em ${filePath}: JSON inválido.`);
  }
  if (
    !isRecord(parsed) ||
    !isRecord(parsed.cases) ||
    typeof parsed.measurementContract !== "number" ||
    typeof parsed.recordedAt !== "string"
  ) {
    throw new Error(`Baseline malformada em ${filePath}: faltam measurementContract, recordedAt ou cases.`);
  }
  return {
    instrument: { agentEvals: "", measurementContract: 0, sdks: {} },
    instructionFingerprints: {},
    leakedSkills: [],
    ...parsed,
  } as unknown as Baseline;
}

export function readBaseline(filePath: string): Baseline | undefined {
  let content: string;
  try {
    content = readFileSync(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  return parseBaseline(content, filePath);
}

export function serializeBaseline(baseline: Baseline): string {
  return `${JSON.stringify(JSON.parse(canonicalJson(baseline)), null, 2)}\n`;
}

export function writeBaseline(filePath: string, baseline: Baseline): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, serializeBaseline(baseline));
}
