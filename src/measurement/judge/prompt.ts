export type JudgeVerdict = "pass" | "fail" | "no-verdict";

export interface JudgeInput {
  criterion: string;
  request: string;
  response: string;
}

export function buildJudgePrompt(input: JudgeInput): string {
  const sections = [
    "Você é um avaliador rigoroso e imparcial. Decida se a resposta abaixo satisfaz o critério da rubrica.",
    "Regra: a resposta vem de um único turno que não pode executar ferramentas nem alterar arquivos, então um compromisso concreto com um comportamento conta como esse comportamento. Uma resposta vazia, evasiva ou fora do assunto não satisfaz nenhuma rubrica.",
  ];
  if (input.request.trim() !== "") sections.push(`## Pedido\n\n${input.request.trim()}`);
  sections.push(`## Resposta\n\n${input.response.trim()}`);
  sections.push(`## Critério\n\n${input.criterion.trim()}`);
  sections.push(
    "Justifique em poucas linhas e termine com uma última linha exatamente no formato `VEREDITO: PASS` ou `VEREDITO: FAIL`.",
  );
  return sections.join("\n\n");
}

export function parseJudgeVerdict(text: string): JudgeVerdict {
  const matches = [...text.matchAll(/^[\s*`>#-]*(?:VEREDITO|VERDICT)\s*:\s*\**\s*(PASS|FAIL)\b/gim)];
  const last = matches.at(-1)?.[1];
  if (last === undefined) return "no-verdict";
  return last.toUpperCase() === "PASS" ? "pass" : "fail";
}
