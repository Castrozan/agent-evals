import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectConfig } from "../configuration/loadProjectConfig.js";
import { checkInstructions, formatInstructionFailure } from "./checkInstructions.js";

let root: string;

function write(relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function check(): string[] {
  return checkInstructions(loadProjectConfig(root)).map(formatInstructionFailure);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "instructions-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("checkInstructions", () => {
  it("accepts a well-formed skill with defaults and no config", () => {
    write("skills/a/SKILL.md", "---\nname: a\ndescription: Faz algo curto\n---\n# A\n[ok](ref.md)\n");
    write("skills/a/ref.md", "x");
    expect(check()).toEqual([]);
  });

  it("reports missing frontmatter and missing fields", () => {
    write("skills/a/SKILL.md", "# sem frontmatter\n");
    write("skills/b/SKILL.md", "---\nname: b\n---\n");
    expect(check()).toEqual([
      "skills/a/SKILL.md:1: frontmatter-obrigatorio: SKILL.md precisa de frontmatter com name e description",
      "skills/b/SKILL.md:1: frontmatter-obrigatorio: o frontmatter de SKILL.md precisa de 'description'",
    ]);
  });

  it("reports long descriptions at the description line", () => {
    const words = Array.from({ length: 36 }, (_, index) => `w${index}`).join(" ");
    write("skills/a/SKILL.md", `---\nname: a\ndescription: ${words}\n---\n`);
    expect(check()).toEqual(["skills/a/SKILL.md:3: descricao-longa: a descrição tem 36 palavras; o máximo é 35"]);
  });

  it("reports broken relative links with 1-based lines, skipping URLs, anchors and code fences", () => {
    write(
      "CLAUDE.md",
      "# t\n\n[a](docs/missing.md) e [b](https://x.dev) e [c](#topo) e [d](docs/there.md#s)\n```\n[e](nope.md)\n```\n",
    );
    write("docs/there.md", "x");
    expect(check()).toEqual(['CLAUDE.md:3: link-quebrado: o destino do link "docs/missing.md" não existe']);
  });
});
