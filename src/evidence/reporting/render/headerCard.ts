import type { ReportDocument } from "../document/reportDocument.js";
import { escapeHtml } from "./escapeHtml.js";
import {
  LEVEL_LABELS,
  STATUS_LABELS,
  formatDate,
  formatDuration,
  formatPercent,
  formatSignedPoints,
  formatUsd,
} from "./formatting.js";
import { reportWarnings } from "./warnings.js";

const STATUS_CLASSES = { approved: "ok", failed: "bad", invalid: "muted" } as const;
const KIND_LABELS = { instruction: "instruções", cli: "CLIs", mcp: "servidores MCP" } as const;

function measuredSentence(document: ReportDocument): string {
  const { measured } = document.header;
  if (!measured.partial) return `Suíte inteira medida: ${measured.totalCases} casos.`;
  const scope = [
    measured.categories.length > 0 ? `categorias ${measured.categories.join(", ")}` : "",
    measured.caseFilters.length > 0 ? `casos ${measured.caseFilters.join(", ")}` : "",
    measured.affected ? "casos afetados" : "",
    measured.partition ? `partição ${measured.partition === "held-out" ? "reservado" : "treino"}` : "",
  ].filter(Boolean);
  const suffix = scope.length > 0 ? ` (${scope.join("; ")})` : "";
  return `Medição parcial${suffix}: ${measured.measuredCases} casos medidos agora, ${measured.inheritedCases} herdados do baseline.`;
}

function rateBlock(document: ReportDocument): string {
  const { header } = document;
  if (header.status === "invalid" || !header.rate) {
    return `<div class="rate muted">sem taxa</div><div class="bad">Medição inválida${header.invalidReason ? `: ${escapeHtml(header.invalidReason)}` : ""}</div>`;
  }
  const delta =
    header.previousRate === null
      ? ""
      : ` <span class="muted">${formatSignedPoints(header.rate.value - header.previousRate)} vs baseline anterior</span>`;
  const passAtK = header.passAtK.map((entry) => `pass@${entry.k} ${formatPercent(entry.value)}`).join(" · ");
  const noise = header.noise
    ? `ruído ${formatPercent(header.noise.floor)} · margem ${formatPercent(header.noise.headroom)}`
    : "";
  return `<div class="rate ${STATUS_CLASSES[header.status]}">${formatPercent(header.rate.value)}</div>
<div>${delta}</div>
<div class="muted">intervalo de Wilson 95%: ${formatPercent(header.rate.lower)} a ${formatPercent(header.rate.upper)} · ${header.rate.passes}/${header.rate.samples} amostras</div>
<div class="muted">${escapeHtml([passAtK, noise].filter(Boolean).join(" · "))}</div>`;
}

function levelsTable(document: ReportDocument): string {
  const rows = document.header.levels
    .map(
      (level) =>
        `<tr><td>${LEVEL_LABELS[level.level]}</td><td>${level.cases}</td><td>${formatUsd(level.costUsd)}</td><td>${formatDuration(level.durationSeconds)}</td></tr>`,
    )
    .join("");
  return `<table><tr><th>Nível</th><th>Casos</th><th>Custo</th><th>Tempo</th></tr>${rows}</table>`;
}

function coverageList(document: ReportDocument): string {
  const items = document.header.coverage
    .map((entry) => `<li>${KIND_LABELS[entry.kind]}: ${entry.covered}/${entry.total}</li>`)
    .join("");
  return `<ul>${items}</ul>`;
}

function calibrationLine(document: ReportDocument): string {
  const { calibration } = document.header;
  if (calibration.status === "never") return "juiz nunca calibrado";
  const stale = calibration.status === "stale" ? " (desatualizada)" : "";
  return `kappa do juiz ${calibration.kappa.toFixed(2).replace(".", ",")}, medido em ${formatDate(calibration.recordedAt)}${stale}`;
}

function testSuiteLine(document: ReportDocument): string {
  const card = document.header.testSuite;
  if (!card) return "";
  const counts =
    card.tests === undefined
      ? ""
      : `${card.tests} testes, ${card.failures ?? 0} falhas, ${card.errors ?? 0} erros, ${card.skipped ?? 0} pulados`;
  const label = card.label ? `${card.label}: ` : "";
  const outcome = card.exitCode === 0 ? "passou" : `saiu com código ${card.exitCode}`;
  const duration = card.durationSeconds === undefined ? "" : `, ${formatDuration(card.durationSeconds)}`;
  return `<p>Suíte de testes · ${escapeHtml(`${label}${outcome}${counts ? ` · ${counts}` : ""}${duration} · ${formatDate(card.ranAt)}${card.commit ? ` · ${card.commit.slice(0, 8)}` : ""}`)}</p>`;
}

export function renderHeaderCard(document: ReportDocument): string {
  const { header } = document;
  const warnings = reportWarnings(document).map((warning) => `<li class="warn">${escapeHtml(warning)}</li>`);
  const reasons = header.reasons.map((reason) => `<li class="bad">${escapeHtml(reason.message)}</li>`);
  const notices = header.notices.map((notice) => `<li class="muted">${escapeHtml(notice)}</li>`);
  const versions = [
    `agent-evals ${header.instrument.agentEvals}`,
    `contrato ${header.instrument.measurementContract}`,
    header.instrument.promptfoo ? `promptfoo ${header.instrument.promptfoo}` : "",
    ...Object.entries(header.instrument.sdks).map(([name, version]) => `${name} ${version}`),
  ].filter(Boolean);
  const identity = [
    header.variant ? `variante ${header.variant}` : "",
    header.revision ? `revisão ${header.revision}` : "",
    header.commit ? `commit ${header.commit.slice(0, 8)}` : "",
    `${header.profile.subject.client}/${header.profile.subject.model}`,
    formatDate(header.generatedAt),
  ].filter(Boolean);
  return `<section class="card">
<h1>${escapeHtml(header.project)} <span class="tag ${STATUS_CLASSES[header.status]}">${STATUS_LABELS[header.status]}</span></h1>
<div class="muted">${escapeHtml(identity.join(" · "))}</div>
<div class="grid"><div>${rateBlock(document)}</div><div>${levelsTable(document)}<div class="muted">Custo e tempo desta medição.</div></div><div><strong>Cobertura</strong>${coverageList(document)}<span class="muted">${document.header.pendingCases} casos pendentes</span></div></div>
<p>${escapeHtml(measuredSentence(document))}</p>
<p class="muted">${escapeHtml(calibrationLine(document))}</p>
${testSuiteLine(document)}
<ul>${warnings.join("")}${reasons.join("")}${notices.join("")}</ul>
<p class="muted">${escapeHtml(versions.join(" · "))}</p>
</section>`;
}
