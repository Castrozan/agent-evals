import type { ReportDocument } from "../document/reportDocument.js";
import { STATUS_LABELS, formatPercent, formatSignedPoints } from "./formatting.js";
import { reportWarnings } from "./warnings.js";

export function renderTerminalSummary(document: ReportDocument): string {
  const { header } = document;
  const lines: string[] = [`${header.project}: ${STATUS_LABELS[header.status]}`];
  if (header.status === "invalid") {
    lines.push(`Medição inválida${header.invalidReason ? `: ${header.invalidReason}` : ""}. Sem taxa e sem veredito.`);
  } else if (header.rate) {
    const delta =
      header.previousRate === null
        ? ""
        : ` (${formatSignedPoints(header.rate.value - header.previousRate)} vs baseline)`;
    lines.push(
      `Taxa por amostra: ${formatPercent(header.rate.value)} [${formatPercent(header.rate.lower)}–${formatPercent(header.rate.upper)}], ${header.rate.passes}/${header.rate.samples}${delta}`,
    );
  }
  const { measured } = header;
  if (measured.partial) {
    lines.push(
      `Medidos ${measured.measuredCases} de ${measured.totalCases} casos; ${measured.inheritedCases} herdados do baseline.`,
    );
  }
  for (const reason of header.reasons) lines.push(`Motivo: ${reason.message}`);
  lines.push(
    `Falhas: ${document.failures.length}; instáveis: ${document.flaky.length}; sem cobertura: ${document.uncovered.length}`,
  );
  for (const warning of reportWarnings(document)) lines.push(`Aviso: ${warning}`);
  return `${lines.join("\n")}\n`;
}
