import { existsSync } from "node:fs";
import { mkdtemp, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface IsolatedCodexHome {
  directory: string;
  dispose(): Promise<void>;
}

export async function createIsolatedCodexHome(environment: Record<string, string>): Promise<IsolatedCodexHome> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-evals-codex-home-"));
  const userHome = environment.CODEX_HOME ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
  const credentials = path.join(userHome, "auth.json");
  if (existsSync(credentials)) await symlink(credentials, path.join(directory, "auth.json"));
  return { directory, dispose: () => rm(directory, { recursive: true, force: true }) };
}
