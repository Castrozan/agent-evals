import { parse } from "yaml";

export interface Frontmatter {
  fields: Record<string, unknown>;
  lineByKey: Record<string, number>;
  endLine: number;
}

export function readFrontmatter(lines: string[]): Frontmatter | undefined {
  if (lines[0]?.trim() !== "---") return undefined;
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (closing === -1) return undefined;
  let fields: unknown;
  try {
    fields = parse(lines.slice(1, closing).join("\n"));
  } catch {
    return undefined;
  }
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) return undefined;
  const lineByKey: Record<string, number> = {};
  lines.slice(1, closing).forEach((line, index) => {
    const key = /^([\w-]+):/.exec(line)?.[1];
    if (key !== undefined) lineByKey[key] = index + 2;
  });
  return { fields: fields as Record<string, unknown>, lineByKey, endLine: closing + 1 };
}
