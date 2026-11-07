import fs from "node:fs/promises";
import { REPORT_SCHEMA_VERSION, type ReportDocument } from "../document/reportDocument.js";
import { renderBadge } from "../render/badge.js";
import { renderHtml } from "../render/html.js";
import { reportPathsFor, type ReportPaths } from "./reportPaths.js";

export async function writeReport(document: ReportDocument, reportPath: string): Promise<ReportPaths> {
  const paths = reportPathsFor(reportPath);
  await fs.mkdir(paths.directory || ".", { recursive: true });
  await Promise.all([
    fs.writeFile(paths.htmlPath, renderHtml(document)),
    fs.writeFile(paths.jsonPath, `${JSON.stringify(document, null, 2)}\n`),
    fs.writeFile(paths.badgePath, renderBadge(document)),
  ]);
  return paths;
}

export async function readReportDocument(jsonPath: string): Promise<ReportDocument> {
  let text: string;
  try {
    text = await fs.readFile(jsonPath, "utf8");
  } catch {
    throw new Error(`Relatório não encontrado em ${jsonPath}; rode \`agent-evals run\` primeiro.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Relatório ilegível em ${jsonPath}: JSON inválido.`);
  }
  const candidate = parsed as Partial<ReportDocument> | null;
  if (candidate?.schemaVersion !== REPORT_SCHEMA_VERSION || !candidate.header || !Array.isArray(candidate.categories)) {
    throw new Error(`Relatório em ${jsonPath} tem formato incompatível; rode \`agent-evals run\` de novo.`);
  }
  return candidate as ReportDocument;
}
