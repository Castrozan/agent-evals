const ENGLISH_FLAG_ALIASES: Record<string, string> = {
  "--category": "--categoria",
  "--case": "--caso",
  "--model": "--modelo",
  "--effort": "--esforco",
  "--client": "--cliente",
  "--variant": "--variante",
  "--repetitions": "--execucoes",
  "--workers": "--trabalhadores",
  "--affected": "--afetados",
  "--resume": "--continuar",
  "--dry-run": "--seco",
  "--paired": "--pareado",
  "--run": "--rodar",
  "--partition": "--particao",
  "--revision": "--revisao",
  "--format": "--formato",
  "--directory": "--diretorio",
  "--recorded": "--gravado",
};

export function translateEnglishFlags(argumentsList: readonly string[]): string[] {
  return argumentsList.map((argument) => {
    const [flag, ...valueParts] = argument.split("=");
    const portugueseFlag = flag === undefined ? undefined : ENGLISH_FLAG_ALIASES[flag];
    if (portugueseFlag === undefined) return argument;
    return valueParts.length === 0 ? portugueseFlag : `${portugueseFlag}=${valueParts.join("=")}`;
  });
}
