import type { ReportDocument } from "../document/reportDocument.js";
import { escapeHtml } from "./escapeHtml.js";
import { STATUS_COLORS, STATUS_LABELS, formatPercent } from "./formatting.js";

const LABEL = "agent-evals";
const CHARACTER_WIDTH = 7;
const PADDING = 12;

export function renderBadge(document: ReportDocument): string {
  const { status, rate } = document.header;
  const message =
    rate && status !== "invalid" ? `${formatPercent(rate.value)} ${STATUS_LABELS[status]}` : STATUS_LABELS[status];
  const labelWidth = LABEL.length * CHARACTER_WIDTH + PADDING;
  const messageWidth = message.length * CHARACTER_WIDTH + PADDING;
  const width = labelWidth + messageWidth;
  const text = `${LABEL}: ${message}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${escapeHtml(text)}">
<title>${escapeHtml(text)}</title>
<rect width="${labelWidth}" height="20" fill="#555"/>
<rect x="${labelWidth}" width="${messageWidth}" height="20" fill="${STATUS_COLORS[status]}"/>
<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${labelWidth / 2}" y="14">${escapeHtml(LABEL)}</text>
<text x="${labelWidth + messageWidth / 2}" y="14">${escapeHtml(message)}</text>
</g>
</svg>
`;
}
