import type { ReportDocument } from "../document/reportDocument.js";
import { escapeHtml } from "./escapeHtml.js";
import { formatDate } from "./formatting.js";

const KIND_LABELS = { instruction: "instrução", cli: "CLI", mcp: "servidor MCP" } as const;

function block(label: string, content: string | undefined): string {
  if (!content) return "";
  return `<p><strong>${label}</strong></p><pre>${escapeHtml(content)}</pre>`;
}

function failureCard(failure: ReportDocument["failures"][number]): string {
  const since = failure.failingSince
    ? `<div class="muted">falhando desde ${formatDate(failure.failingSince)}</div>`
    : "";
  const tags = [
    failure.heldOut ? '<span class="tag">reservado</span>' : "",
    failure.inherited ? '<span class="tag">herdado</span>' : "",
  ].join(" ");
  const assertions =
    failure.failedAssertions.length > 0
      ? `<ul>${failure.failedAssertions.map((message) => `<li>${escapeHtml(message)}</li>`).join("")}</ul>`
      : "";
  return `<article class="card"><h3>${escapeHtml(failure.key)} ${tags} <span class="bad">${failure.passes}/${failure.samples}</span></h3>${since}
${block("Entrada", failure.input)}${block("Esperado", failure.expected.length > 0 ? failure.expected.join("\n") : undefined)}${block("Saída obtida", failure.actualOutput)}${assertions}</article>`;
}

export function renderFailures(document: ReportDocument): string {
  const body =
    document.failures.length === 0
      ? '<p class="muted">Nenhuma falha.</p>'
      : document.failures.map(failureCard).join("");
  return `<section><h2>Falhas</h2>${body}</section>`;
}

export function renderFlaky(document: ReportDocument): string {
  const items = document.flaky
    .map(
      (entry) =>
        `<li>${escapeHtml(entry.key)}${entry.heldOut ? ' <span class="tag">reservado</span>' : ""}: ${entry.passes}/${entry.samples}</li>`,
    )
    .join("");
  const body = items ? `<ul>${items}</ul>` : '<p class="muted">Nenhum caso instável.</p>';
  return `<section><h2>Instáveis</h2><div class="card">${body}</div></section>`;
}

export function renderUncovered(document: ReportDocument): string {
  const items = document.uncovered
    .map(
      (entry) =>
        `<li>${KIND_LABELS[entry.kind]} ${escapeHtml(entry.path)}${entry.onlyPending ? " (só casos pendentes)" : ""}</li>`,
    )
    .join("");
  const body = items ? `<ul>${items}</ul>` : '<p class="muted">Todos os artefatos têm cobertura.</p>';
  return `<section><h2>Sem cobertura</h2><div class="card">${body}</div></section>`;
}
