import picomatch from "picomatch";
import type { Baseline, VerdictReason } from "../domain/baseline.js";
import { callsModel, caseKey, type EvalCase } from "../domain/cases.js";
import type { Thresholds } from "../domain/project.js";
import { normalizeRelativePath } from "../fingerprint/instructionPaths.js";
import { oldestMeasurement } from "./rateGates.js";

const MILLISECONDS_PER_DAY = 86_400_000;

function categoriesUsingFile(suiteCases: readonly EvalCase[], file: string): string[] {
  const categories = new Set<string>();
  for (const evalCase of suiteCases) {
    if (!callsModel(evalCase)) continue;
    const patterns = [
      ...(evalCase.instruction === undefined ? [] : [evalCase.instruction]),
      ...evalCase.extraInstructions,
    ];
    if (patterns.some((pattern) => picomatch.isMatch(file, normalizeRelativePath(pattern), { dot: true }))) {
      categories.add(evalCase.category);
    }
  }
  return [...categories].sort();
}

export function changedInstructionReasons(
  baseline: Baseline,
  now: Record<string, string>,
  suiteCases: readonly EvalCase[],
): VerdictReason[] {
  const reasons: VerdictReason[] = [];
  for (const [file, recorded] of Object.entries(baseline.instructionFingerprints ?? {})) {
    if (now[file] === undefined || now[file] === recorded) continue;
    const categories = categoriesUsingFile(suiteCases, file);
    const target = categories.length === 0 ? "" : ` (categoria ${categories.join(", ")})`;
    reasons.push({
      code: "instrucao-alterada",
      file,
      ...(categories.length === 1 ? { category: categories[0] } : {}),
      message: `Instrução ${file} mudou após a medição${target}: rode a categoria novamente.`,
    });
  }
  return reasons;
}

export function expiredEvidenceReasons(baseline: Baseline, thresholds: Thresholds, now: Date): VerdictReason[] {
  const oldest = oldestMeasurement(baseline) ?? baseline.recordedAt;
  const ageDays = (now.getTime() - new Date(oldest).getTime()) / MILLISECONDS_PER_DAY;
  if (ageDays <= thresholds.validityDays) return [];
  return [
    {
      code: "baseline-vencida",
      message: `Medição mais antiga de ${oldest.slice(0, 10)} tem ${Math.floor(ageDays)} dias, acima da validade de ${thresholds.validityDays} dias.`,
    },
  ];
}

export function profileReasons(baseline: Baseline, canonicalProfileId: string): VerdictReason[] {
  if (baseline.profileId === undefined || baseline.profileId === canonicalProfileId) return [];
  return [
    {
      code: "perfil-diferente",
      message: `A baseline foi medida com o perfil ${baseline.profileId}, diferente do canônico ${canonicalProfileId}.`,
    },
  ];
}

export function coverageReasons(
  baseline: Baseline,
  suiteCases: readonly EvalCase[],
  thresholds: Thresholds,
): VerdictReason[] {
  const reasons: VerdictReason[] = [];
  const activeCases = suiteCases.filter((evalCase) => !evalCase.pending);
  const activeKeys = new Set(activeCases.map(caseKey));
  const entries = Object.entries(baseline.cases);
  for (const category of thresholds.requiredCategories) {
    if (entries.some(([key, entry]) => entry.category === category && activeKeys.has(key))) continue;
    reasons.push({
      code: "categoria-obrigatoria-ausente",
      category,
      message: `Categoria obrigatória "${category}" sem resultados.`,
    });
  }
  for (const [key, entry] of entries) {
    if (activeKeys.has(key)) {
      if (entry.type === "instruction" && entry.samples < thresholds.minimumRepetitions) {
        reasons.push({
          code: "execucoes-insuficientes",
          caseKey: key,
          category: entry.category,
          message: `Caso ${key} com ${entry.samples} execuções, abaixo do mínimo de ${thresholds.minimumRepetitions}.`,
        });
      }
      continue;
    }
    reasons.push({
      code: "caso-removido",
      caseKey: key,
      category: entry.category,
      message: `Caso ${key} está na baseline mas não está mais na suíte (removido ou pendente).`,
    });
  }
  for (const evalCase of activeCases) {
    const key = caseKey(evalCase);
    if (baseline.cases[key] !== undefined) continue;
    reasons.push({
      code: "caso-sem-resultado",
      caseKey: key,
      category: evalCase.category,
      message: `Caso ${key} da suíte não tem resultado na baseline.`,
    });
  }
  return reasons;
}
