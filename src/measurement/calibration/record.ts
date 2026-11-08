import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CalibrationRecord } from "../../domain/artifacts.js";
import { canonicalJson, sha256Hex } from "../../inputs/fingerprint/canonical.js";

export const CALIBRATION_RECORD_FILE = "calibracao.json";

export function calibrationRecordPath(corpusPath: string): string {
  return path.join(path.dirname(corpusPath), CALIBRATION_RECORD_FILE);
}

export function corpusFingerprint(corpusContent: string): string {
  return sha256Hex(corpusContent);
}

export function readCalibrationRecord(recordPath: string): CalibrationRecord | undefined {
  let content: string;
  try {
    content = readFileSync(recordPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return JSON.parse(content) as CalibrationRecord;
  } catch {
    throw new Error(`Registro de calibração ilegível em ${recordPath}: JSON inválido.`);
  }
}

export function writeCalibrationRecord(recordPath: string, record: CalibrationRecord): void {
  mkdirSync(path.dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, `${JSON.stringify(JSON.parse(canonicalJson(record)), null, 2)}\n`);
}

export function isCalibrationStale(record: CalibrationRecord, currentCorpusFingerprint: string): boolean {
  return record.corpusFingerprint !== currentCorpusFingerprint;
}
