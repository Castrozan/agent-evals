import { readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ClientName } from "../domain/clients.js";

const USER_SKILL_DIRECTORIES: Record<ClientName, string[]> = {
  claude: [".claude", "skills"],
  codex: [".codex", "skills"],
  opencode: [".config", "opencode", "skills"],
};

export function userSkillNames(client: ClientName, home = os.homedir()): string[] {
  try {
    return readdirSync(path.join(home, ...USER_SKILL_DIRECTORIES[client]), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

export function detectLeakedSkills(client: ClientName, visibleSkills: string[], home = os.homedir()): string[] {
  const userSkills = new Set(userSkillNames(client, home));
  return [...new Set(visibleSkills.filter((name) => userSkills.has(name)))].sort();
}
