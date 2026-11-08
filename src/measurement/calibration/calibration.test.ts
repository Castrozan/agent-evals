import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { CalibrationRecord } from "../../domain/artifacts.js";
import { checkCalibrationGate, verdictFlips } from "./gate.js";
import {
  calibrationRecordPath,
  corpusFingerprint,
  isCalibrationStale,
  readCalibrationRecord,
  writeCalibrationRecord,
} from "./record.js";

describe("calibration record", () => {
  it("round-trips beside the corpus and detects a changed corpus", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "calibration-"));
    const recordPath = calibrationRecordPath(path.join(directory, "calibracao.yaml"));
    expect(recordPath).toBe(path.join(directory, "calibracao.json"));
    expect(readCalibrationRecord(recordPath)).toBeUndefined();
    const record: CalibrationRecord = {
      corpusFingerprint: corpusFingerprint("corpus"),
      judge: { client: "claude" },
      items: 10,
      accuracy: 0.9,
      balancedAccuracy: 0.9,
      recall: 0.9,
      kappa: 0.7,
      passes: 1,
      recordedAt: "2026-11-07T00:00:00.000Z",
    };
    writeCalibrationRecord(recordPath, record);
    expect(readCalibrationRecord(recordPath)).toEqual(record);
    expect(isCalibrationStale(record, corpusFingerprint("corpus"))).toBe(false);
    expect(isCalibrationStale(record, corpusFingerprint("corpus changed"))).toBe(true);
  });
});

describe("calibration gate", () => {
  it("requires accuracy 0.80 and kappa 0.60", () => {
    expect(checkCalibrationGate({ accuracy: 0.8, kappa: 0.6 }).passed).toBe(true);
    expect(checkCalibrationGate({ accuracy: 0.79, kappa: 0.9 }).failures).toHaveLength(1);
    expect(checkCalibrationGate({ accuracy: 0.5, kappa: 0.1 }).failures).toHaveLength(2);
  });

  it("lists items whose verdict flips between passes", () => {
    expect(
      verdictFlips([
        [true, true],
        [true, false],
        [false, false],
        [false, true, false],
      ]),
    ).toEqual([1, 3]);
  });
});
