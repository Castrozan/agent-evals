import type { Verdict } from "../../domain/baseline.js";

export function renderVerdict(verdict: Verdict): string {
  if (verdict.invalid) return "Execução inválida: sem veredito.\n";
  const lines = [verdict.passed ? "Veredito: aprovado." : `Veredito: reprovado (${verdict.reasons.length} motivos).`];
  for (const reason of verdict.reasons) lines.push(`  - [${reason.code}] ${reason.message}`);
  for (const notice of verdict.notices) lines.push(`  ! ${notice}`);
  return `${lines.join("\n")}\n`;
}
