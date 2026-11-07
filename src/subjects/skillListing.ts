export const SKILL_LISTING_PROMPT =
  "Liste os nomes exatos de todas as skills que esta sessão enxerga, um nome por linha, sem explicações nem marcadores. Se não houver nenhuma, responda apenas NENHUMA.";

const NAME_PATTERN = /^[A-Za-z0-9][\w.:-]*$/;
const NAME_WITH_DESCRIPTION_PATTERN = /^([A-Za-z0-9][\w.:-]*)\s+[-–—]\s/;

export function parseSkillNames(text: string): string[] {
  const names: string[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine
      .trim()
      .replace(/^([-*•]|\d+[.)])\s+/, "")
      .replace(/^`+|`+$/g, "")
      .replace(/^\*\*|\*\*$/g, "")
      .trim();
    const name = NAME_PATTERN.test(line) ? line : NAME_WITH_DESCRIPTION_PATTERN.exec(line)?.[1];
    if (!name || name.toUpperCase() === "NENHUMA" || names.includes(name)) continue;
    names.push(name);
  }
  return names;
}
