import type { SuiteCounts } from "./junit.js";

function groupValue(groups: Record<string, string | undefined>, names: string[]): number | undefined {
  for (const name of names) {
    const raw = groups[name];
    if (raw !== undefined && raw !== "") return Number(raw);
  }
  return undefined;
}

export function parseCountPattern(pattern: string, output: string): SuiteCounts | undefined {
  const matches = [...output.matchAll(new RegExp(pattern, "gm"))];
  const groups = matches.at(-1)?.groups;
  if (!groups) return undefined;
  const passed = groupValue(groups, ["passou", "passed"]);
  const failed = groupValue(groups, ["falhou", "failed"]);
  const skipped = groupValue(groups, ["pulou", "skipped"]);
  if (passed === undefined) return undefined;
  return { tests: passed + (failed ?? 0) + (skipped ?? 0), failures: failed ?? 0, skipped: skipped ?? 0 };
}
