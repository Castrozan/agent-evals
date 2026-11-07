import { describe, expect, it } from "vitest";
import { judgeRecordedEvidenceOnly } from "./recordedEvidence.js";

describe("judgeRecordedEvidenceOnly", () => {
  it("turns stale evidence into notices and keeps quality gates failing", () => {
    const verdict = judgeRecordedEvidenceOnly({
      passed: false,
      invalid: false,
      reasons: [
        { code: "instrucao-alterada", message: "a mudou" },
        { code: "caso-sem-resultado", message: "b sem resultado" },
      ],
      notices: [],
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.notices).toEqual(["Sem medição atual: a mudou", "Sem medição atual: b sem resultado"]);

    const failing = judgeRecordedEvidenceOnly({
      passed: false,
      invalid: false,
      reasons: [
        { code: "piso-geral", message: "abaixo do piso" },
        { code: "baseline-vencida", message: "velha" },
      ],
      notices: [],
    });
    expect(failing.passed).toBe(false);
    expect(failing.reasons.map((reason) => reason.code)).toEqual(["piso-geral"]);
  });
});
