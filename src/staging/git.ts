import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { StagingError } from "./stagingError.js";

const execFileAsync = promisify(execFile);

const IDENTITY = [
  "-c",
  "user.name=agent-evals",
  "-c",
  "user.email=agent-evals@localhost",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "core.hooksPath=/dev/null",
];

export async function runGit(directory: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", [...IDENTITY, ...args], {
      cwd: directory,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return stdout.trim();
  } catch (error) {
    const detail = (error as { stderr?: string }).stderr?.trim() || (error as Error).message;
    throw new StagingError(`Falha ao executar git ${args[0]}: ${detail}`);
  }
}

export async function initializeRepository(directory: string, remote?: string): Promise<void> {
  await runGit(directory, ["init", "--quiet"]);
  if (remote) await runGit(directory, ["remote", "add", "origin", remote]);
  await runGit(directory, ["add", "--all"]);
  await runGit(directory, ["commit", "--quiet", "--allow-empty", "--message", "estado inicial da sessão"]);
}
