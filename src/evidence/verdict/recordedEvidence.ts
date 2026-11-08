import type { Verdict } from "../../domain/baseline.js";

const STALE_EVIDENCE_CODES = new Set(["instrucao-alterada", "baseline-vencida", "caso-sem-resultado", "caso-removido"]);

export function judgeRecordedEvidenceOnly(verdict: Verdict): Verdict {
  const stale = verdict.reasons.filter((reason) => STALE_EVIDENCE_CODES.has(reason.code));
  const reasons = verdict.reasons.filter((reason) => !STALE_EVIDENCE_CODES.has(reason.code));
  return {
    ...verdict,
    reasons,
    passed: !verdict.invalid && reasons.length === 0,
    notices: [...verdict.notices, ...stale.map((reason) => `Sem medição atual: ${reason.message}`)],
  };
}
