import os from "node:os";
import path from "node:path";
import { globSync } from "tinyglobby";
import type { ClientName } from "../../domain/clients.js";

const USER_SKILL_ROOTS: Record<ClientName, string[][]> = {
  claude: [
    [".claude", "skills"],
    [".claude", "plugins", "cache"],
  ],
  codex: [
    [".codex", "skills"],
    [".agents", "skills"],
    [".codex", "plugins", "cache"],
  ],
  opencode: [
    [".config", "opencode", "skills"],
    [".claude", "skills"],
  ],
};

const SKILL_SEARCH_DEPTH = 8;

function skillNamesUnder(root: string): string[] {
  return globSync("**/SKILL.md", { cwd: root, deep: SKILL_SEARCH_DEPTH, followSymbolicLinks: true }).map((skillFile) =>
    path.basename(path.dirname(path.join(root, skillFile))),
  );
}

export function userSkillNames(client: ClientName, home = os.homedir()): string[] {
  const names = USER_SKILL_ROOTS[client].flatMap((segments) => skillNamesUnder(path.join(home, ...segments)));
  return [...new Set(names)].sort();
}

function bareSkillName(name: string): string {
  return name.slice(name.lastIndexOf(":") + 1);
}

export function detectLeakedSkills(client: ClientName, visibleSkills: string[], home = os.homedir()): string[] {
  const userSkills = new Set(userSkillNames(client, home));
  return [...new Set(visibleSkills.filter((name) => userSkills.has(bareSkillName(name))))].sort();
}
