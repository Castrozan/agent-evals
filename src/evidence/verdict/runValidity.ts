import { measuredSamples, type RunRecord } from "../../domain/results.js";

export function casesWithoutMeasurements(record: RunRecord): string[] {
  return record.cases
    .filter((result) => result.type === "instruction" && measuredSamples(result).length === 0)
    .map((result) => result.caseKey);
}

export function assessRunValidity(record: RunRecord): { invalid: boolean; reason?: string } {
  const unmeasured = casesWithoutMeasurements(record);
  if (unmeasured.length === 0) return { invalid: false };
  return {
    invalid: true,
    reason: `casos sem nenhuma amostra medida por falha do instrumento: ${unmeasured.join(", ")}`,
  };
}
