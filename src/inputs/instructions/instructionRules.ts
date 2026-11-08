import path from "node:path";
import type { InstructionFormatFailure } from "../../domain/artifacts.js";
import { readFrontmatter } from "./frontmatter.js";

export const MAXIMUM_DESCRIPTION_WORDS = 35;

const MARKDOWN_LINK = /\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]*)[^)]*\)/g;
const EXTERNAL_TARGET = /^([a-z][a-z0-9+.-]*:|\/\/|#)/i;

export type FileExists = (relativePath: string) => boolean;

function failure(file: string, line: number, rule: string, message: string): InstructionFormatFailure {
  return { file, line, rule, message };
}

function checkSkillFrontmatter(file: string, lines: string[]): InstructionFormatFailure[] {
  const frontmatter = readFrontmatter(lines);
  if (!frontmatter) {
    return [failure(file, 1, "frontmatter-obrigatorio", "SKILL.md precisa de frontmatter com name e description")];
  }
  const failures: InstructionFormatFailure[] = [];
  for (const field of ["name", "description"]) {
    const value = frontmatter.fields[field];
    if (typeof value !== "string" || value.trim() === "") {
      failures.push(failure(file, 1, "frontmatter-obrigatorio", `o frontmatter de SKILL.md precisa de '${field}'`));
    }
  }
  const description = frontmatter.fields.description;
  if (typeof description === "string") {
    const words = description.trim().split(/\s+/).filter(Boolean).length;
    if (words > MAXIMUM_DESCRIPTION_WORDS) {
      failures.push(
        failure(
          file,
          frontmatter.lineByKey.description ?? 1,
          "descricao-longa",
          `a descrição tem ${words} palavras; o máximo é ${MAXIMUM_DESCRIPTION_WORDS}`,
        ),
      );
    }
  }
  return failures;
}

function checkLinks(file: string, lines: string[], fileExists: FileExists): InstructionFormatFailure[] {
  const failures: InstructionFormatFailure[] = [];
  let insideFence = false;
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      insideFence = !insideFence;
      return;
    }
    if (insideFence) return;
    for (const match of line.matchAll(MARKDOWN_LINK)) {
      const raw = (match[1] ?? "").replace(/^<|>$/g, "");
      if (raw === "" || EXTERNAL_TARGET.test(raw)) continue;
      const target = decodeURI(raw.split(/[#?]/)[0] ?? "");
      if (target === "") continue;
      const resolved = target.startsWith("/")
        ? target.slice(1)
        : path.posix.normalize(path.posix.join(path.posix.dirname(file), target));
      if (!fileExists(resolved)) {
        failures.push(failure(file, index + 1, "link-quebrado", `o destino do link "${raw}" não existe`));
      }
    }
  });
  return failures;
}

export function checkInstructionContent(
  file: string,
  content: string,
  fileExists: FileExists,
): InstructionFormatFailure[] {
  const lines = content.split(/\r?\n/);
  const skillFailures = path.posix.basename(file) === "SKILL.md" ? checkSkillFrontmatter(file, lines) : [];
  return [...skillFailures, ...checkLinks(file, lines, fileExists)];
}
