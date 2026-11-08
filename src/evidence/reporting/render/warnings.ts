import type { ReportDocument } from "../document/reportDocument.js";
import { formatDate } from "./formatting.js";

export function reportWarnings(document: ReportDocument): string[] {
  const { header } = document;
  const warnings: string[] = [];
  if (!header.isolation.isolated) {
    warnings.push(`medição não isolada: skills do usuário vazaram (${header.isolation.leakedSkills.join(", ")})`);
  }
  if (header.calibration.status === "never") warnings.push("juiz nunca calibrado");
  if (header.calibration.status === "stale") {
    warnings.push(
      `calibração do juiz desatualizada (corpus alterado desde ${formatDate(header.calibration.recordedAt)})`,
    );
  }
  if (header.noise && !header.noise.headroomExceedsNoise) {
    warnings.push("margem de melhora menor ou igual ao ruído da medição: a suíte não distingue regressões pequenas");
  }
  return warnings;
}
