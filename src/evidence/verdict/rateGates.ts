import type { Baseline, BaselineCaseEntry } from "../../domain/baseline.js";
import type { Thresholds } from "../../domain/project.js";
import { headroomExceedsNoise } from "../statistics/proportions.js";
import { formatPercent, pooledRate } from "./rates.js";
import type { GateOutcome } from "./types.js";

export function evaluateRateGates(entries: Record<string, BaselineCaseEntry>, thresholds: Thresholds): GateOutcome {
  const reasons: GateOutcome["reasons"] = [];
  const notices: string[] = [];
  const all = Object.values(entries);
  if (all.length === 0) return { reasons, notices };
  const overall = pooledRate(all);
  if (overall.rate < thresholds.overallFloor) {
    reasons.push({
      code: "piso-geral",
      message: `Taxa geral de ${formatPercent(overall.rate)} abaixo do piso de ${formatPercent(thresholds.overallFloor)}.`,
    });
  }
  for (const category of thresholds.criticalCategories) {
    const categoryEntries = all.filter((entry) => entry.category === category);
    if (categoryEntries.length === 0) continue;
    const categoryRate = pooledRate(categoryEntries);
    if (categoryRate.rate < thresholds.criticalFloor) {
      reasons.push({
        code: "piso-critico",
        category,
        message: `Categoria crítica "${category}" com ${formatPercent(categoryRate.rate)}, abaixo do piso de ${formatPercent(thresholds.criticalFloor)}.`,
      });
    }
  }
  const repetitions = overall.samples / all.length;
  if (!headroomExceedsNoise(overall.rate, all.length, repetitions)) {
    notices.push(
      `Margem de ${formatPercent(1 - overall.rate)} não supera o ruído de medição: aumente casos ou execuções.`,
    );
  }
  return { reasons, notices };
}

export function oldestMeasurement(baseline: Baseline): string | undefined {
  const dates = Object.values(baseline.cases).map((entry) => entry.measuredAt);
  return dates.sort()[0];
}
