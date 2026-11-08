import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { globSync } from "tinyglobby";
import { parse } from "yaml";
import type { ClientName } from "../../domain/clients.js";
import { resolveInside } from "./pathSafety.js";
import { StagingError } from "./stagingError.js";

const SKILL_ROOT_BY_CLIENT: Record<ClientName, string> = {
  claude: ".claude/skills",
  codex: ".agents/skills",
  opencode: ".opencode/skills",
};

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function skillRootFor(client: ClientName): string {
  return SKILL_ROOT_BY_CLIENT[client];
}

function declaredName(content: string): string | undefined {
  const match = FRONTMATTER_PATTERN.exec(content);
  if (!match) return undefined;
  const name = (parse(match[1] ?? "") as { name?: unknown } | null)?.name;
  return typeof name === "string" && name !== "" ? name : undefined;
}

async function installSkillDirectory(skillsDirectory: string, sourcePath: string): Promise<void> {
  const sourceDirectory = path.dirname(sourcePath);
  const name = declaredName(await readFile(sourcePath, "utf8")) ?? path.basename(sourceDirectory);
  await cp(sourceDirectory, resolveInside(skillsDirectory, name, "nome da skill"), { recursive: true, force: true });
}

async function installInstructionFile(skillsDirectory: string, sourcePath: string): Promise<void> {
  const content = await readFile(sourcePath, "utf8");
  const name = path.basename(sourcePath, path.extname(sourcePath));
  const target = resolveInside(skillsDirectory, name, "nome da skill");
  await mkdir(target, { recursive: true });
  const body = FRONTMATTER_PATTERN.test(content)
    ? content
    : `---\nname: ${name}\ndescription: ${name}\n---\n${content}`;
  await writeFile(path.join(target, "SKILL.md"), body);
}

export async function installSkills(
  client: ClientName,
  sessionDirectory: string,
  sourceRoot: string,
  instructionPatterns: string[],
): Promise<void> {
  const skillsDirectory = path.join(sessionDirectory, skillRootFor(client));
  await mkdir(skillsDirectory, { recursive: true });
  for (const pattern of instructionPatterns) {
    resolveInside(sourceRoot, pattern, "caminho da instrução");
    const matches = globSync(pattern, { cwd: sourceRoot, absolute: true, dot: true });
    if (matches.length === 0) throw new StagingError(`Nenhum arquivo de instrução corresponde a "${pattern}".`);
    for (const match of matches.sort()) {
      if (path.basename(match) === "SKILL.md") await installSkillDirectory(skillsDirectory, match);
      else await installInstructionFile(skillsDirectory, match);
    }
  }
}
