import type { ReportCase, ReportCategory, ReportGroup } from "../document/reportDocument.js";
import { escapeHtml } from "./escapeHtml.js";
import { LEVEL_LABELS, formatDate, formatPercent } from "./formatting.js";

const STATUS_MARKS = {
  passed: ["ok", "passou"],
  failed: ["bad", "falhou"],
  unmeasured: ["muted", "sem amostras"],
} as const;

function caseRow(reportCase: ReportCase): string {
  const [className, label] = STATUS_MARKS[reportCase.status];
  const tags = [
    reportCase.heldOut ? '<span class="tag">reservado</span>' : "",
    reportCase.flaky ? '<span class="tag">instável</span>' : "",
    reportCase.inherited ? `<span class="tag">herdado, medido em ${formatDate(reportCase.measuredAt)}</span>` : "",
  ].join(" ");
  const control =
    reportCase.pairedControl &&
    reportCase.pairedControl.withoutInstructionPasses === reportCase.passes &&
    reportCase.pairedControl.pValue >= 0.05
      ? ' <span class="tag">mede o modelo, não a instrução</span>'
      : "";
  return `<tr><td>${escapeHtml(reportCase.name)} ${tags}${control}</td><td>${LEVEL_LABELS[reportCase.level]}</td><td class="${className}">${label}</td><td>${reportCase.passes}/${reportCase.samples}</td></tr>`;
}

function groupCard(group: ReportGroup): string {
  const title = group.path ?? "Casos sem artefato";
  const subtitle =
    group.path && group.name !== group.path ? `<span class="muted"> ${escapeHtml(group.name)}</span>` : "";
  return `<article class="card"><h3>${escapeHtml(title)}${subtitle} <span class="muted">${formatPercent(group.rate)}</span></h3>
<table><tr><th>Caso</th><th>Nível</th><th>Resultado</th><th>Amostras</th></tr>${group.cases.map(caseRow).join("")}</table></article>`;
}

export function renderCategories(categories: ReportCategory[]): string {
  return categories
    .map(
      (category) =>
        `<section><h2>${escapeHtml(category.name)} <span class="muted">${formatPercent(category.rate)}</span></h2>${category.groups.map(groupCard).join("")}</section>`,
    )
    .join("\n");
}
