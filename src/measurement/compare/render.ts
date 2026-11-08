import type { VariantComparison } from "./compare.js";

function formatDelta(delta: number | undefined): string {
  if (delta === undefined) return "n/d";
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(1).replace(".", ",")}%`;
}

function formatP(pValue: number): string {
  return pValue.toFixed(3).replace(".", ",");
}

export function renderComparisonJson(comparison: VariantComparison): string {
  return `${JSON.stringify(comparison, null, 2)}\n`;
}

export function renderComparisonText(comparison: VariantComparison): string {
  const { labelA, labelB, totals, regression } = comparison;
  const lines = [`Comparação ${labelA} -> ${labelB}`];
  for (const entry of comparison.cases) {
    lines.push(
      `  ${entry.caseKey}: passou ${entry.passedA}/${entry.samplesA} -> ${entry.passedB}/${entry.samplesB}; ` +
        `tokens ${entry.tokens.medianA} -> ${entry.tokens.medianB} (${formatDelta(entry.tokens.deltaPercent)}, p=${formatP(entry.tokens.pValue)}); ` +
        `saída de ferramentas ${entry.toolOutput.medianA} -> ${entry.toolOutput.medianB} (${formatDelta(entry.toolOutput.deltaPercent)}, p=${formatP(entry.toolOutput.pValue)}); ` +
        `custo ${entry.costA.toFixed(4)} -> ${entry.costB.toFixed(4)} (${formatDelta(entry.costDeltaPercent)})`,
    );
  }
  for (const key of comparison.onlyInA) lines.push(`  ${key}: somente em ${labelA}`);
  for (const key of comparison.onlyInB) lines.push(`  ${key}: somente em ${labelB}`);
  lines.push(
    `Total: passou ${totals.passedA}/${totals.samplesA} -> ${totals.passedB}/${totals.samplesB}; ` +
      `custo ${totals.costA.toFixed(4)} -> ${totals.costB.toFixed(4)} (${formatDelta(totals.costDeltaPercent)})`,
  );
  const verdict = regression.significant ? `regrediu em ${labelB}` : "sem regressão significativa";
  lines.push(
    `McNemar ${labelA} -> ${labelB}: ${regression.fell.length} caíram, ${regression.rose.length} subiram, p=${formatP(regression.pValue)}: ${verdict}.`,
  );
  if (regression.fell.length > 0) lines.push(`  Caíram: ${regression.fell.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
