import type { ReportDocument } from "../document/reportDocument.js";
import { renderCategories } from "./caseCards.js";
import { escapeHtml } from "./escapeHtml.js";
import { renderHeaderCard } from "./headerCard.js";
import { PAGE_STYLES } from "./htmlStyles.js";
import { renderFailures, renderFlaky, renderUncovered } from "./problemSections.js";

export function renderHtml(document: ReportDocument): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(document.header.project)} · relatório de evals</title>
<style>${PAGE_STYLES}</style>
</head>
<body>
<main>
${renderHeaderCard(document)}
${renderCategories(document.categories)}
${renderFailures(document)}
${renderFlaky(document)}
${renderUncovered(document)}
</main>
</body>
</html>
`;
}
