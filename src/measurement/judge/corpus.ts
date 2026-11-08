import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { corpusFingerprint } from "../calibration/record.js";

export interface CalibrationItem {
  name: string;
  request: string;
  output: string;
  rubric: string;
  expectedPass: boolean;
}

export interface CalibrationCorpus {
  items: CalibrationItem[];
  fingerprint: string;
}

const KEY_ALIASES = {
  name: ["nome", "name"],
  request: ["pedido", "request"],
  output: ["saida", "output"],
  rubric: ["rubrica", "rubric"],
  label: ["rotulo", "label"],
} as const;

function pickText(entry: Record<string, unknown>, key: keyof typeof KEY_ALIASES, position: number, file: string) {
  for (const alias of KEY_ALIASES[key]) {
    const value = entry[alias];
    if (typeof value === "string") return value;
  }
  if (key === "request" || key === "name") return "";
  throw new Error(`Item ${position + 1} do corpus ${file} sem o campo "${KEY_ALIASES[key].join("|")}".`);
}

function toItem(entry: unknown, position: number, file: string): CalibrationItem {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new Error(`Item ${position + 1} do corpus ${file} não é um mapa.`);
  }
  const record = entry as Record<string, unknown>;
  const label = pickText(record, "label", position, file).trim().toUpperCase();
  if (label !== "PASS" && label !== "FAIL") {
    throw new Error(`Item ${position + 1} do corpus ${file} com rótulo inválido "${label}": use PASS ou FAIL.`);
  }
  return {
    name: pickText(record, "name", position, file) || `item ${position + 1}`,
    request: pickText(record, "request", position, file),
    output: pickText(record, "output", position, file),
    rubric: pickText(record, "rubric", position, file),
    expectedPass: label === "PASS",
  };
}

export function readCalibrationCorpus(corpusPath: string): CalibrationCorpus {
  let content: string;
  try {
    content = readFileSync(corpusPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Corpus de calibração não encontrado: ${corpusPath}.`);
    }
    throw error;
  }
  const parsed: unknown = parse(content);
  const entries = Array.isArray(parsed)
    ? parsed
    : ((parsed as Record<string, unknown> | null)?.itens ?? (parsed as Record<string, unknown> | null)?.items);
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`Corpus de calibração ${corpusPath} sem itens.`);
  }
  return {
    items: entries.map((entry, position) => toItem(entry, position, corpusPath)),
    fingerprint: corpusFingerprint(content),
  };
}
