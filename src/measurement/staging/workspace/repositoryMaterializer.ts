import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { globSync } from "tinyglobby";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RepositorySource } from "../../../domain/cases.js";
import { runGit } from "./git.js";
import { StagingError } from "../stagingError.js";

const execFileAsync = promisify(execFile);

const LOCAL_ORIGIN_DIRECTORY = "agent-evals-origin.git";

async function fetchRemoteCommit(destination: string, source: RepositorySource): Promise<void> {
  const remote = source.remote as string;
  await runGit(destination, ["init", "--quiet"]);
  await runGit(destination, ["fetch", "--quiet", "--depth", "1", remote, source.revision]);
  await runGit(destination, ["checkout", "--quiet", "--detach", "FETCH_HEAD"]);
  const localOrigin = path.join(destination, ".git", LOCAL_ORIGIN_DIRECTORY);
  await runGit(destination, ["init", "--quiet", "--bare", localOrigin]);
  await runGit(localOrigin, ["config", "receive.shallowUpdate", "true"]);
  const branch = source.branch ?? "main";
  await runGit(destination, ["push", "--quiet", localOrigin, `HEAD:refs/heads/${branch}`]);
  await runGit(destination, ["remote", "add", "origin", localOrigin]);
  await runGit(destination, ["fetch", "--quiet", "origin"]);
  await runGit(destination, ["checkout", "--quiet", "-B", branch, "--track", `origin/${branch}`]);
}

async function archiveEvaluatedRepository(destination: string, source: RepositorySource, sourceRoot: string) {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "agent-evals-archive-"));
  const archivePath = path.join(scratch, "tree.tar");
  try {
    await runGit(sourceRoot, ["archive", "--format=tar", "--output", archivePath, source.revision]);
    await execFileAsync("tar", ["-xf", archivePath, "-C", destination]);
  } catch (error) {
    if (error instanceof StagingError) throw error;
    throw new StagingError(`Falha ao extrair o repositório na revisão ${source.revision}: ${(error as Error).message}`);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
  if (source.exclude.length === 0) return;
  const excluded = globSync(source.exclude, {
    cwd: destination,
    dot: true,
    onlyFiles: false,
    expandDirectories: false,
  });
  for (const relative of excluded) await rm(path.join(destination, relative), { recursive: true, force: true });
}

export async function materializeRepository(
  destination: string,
  source: RepositorySource,
  sourceRoot: string,
): Promise<void> {
  await mkdir(destination, { recursive: true });
  if (source.remote) await fetchRemoteCommit(destination, source);
  else await archiveEvaluatedRepository(destination, source, sourceRoot);
}
