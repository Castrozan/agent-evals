import { cp, lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface PreparedWorkingTree {
  directory: string;
  overlaidPaths: string[];
  commit: string;
  dispose(): Promise<void>;
}

interface StatusChange {
  path: string;
  deleted: boolean;
}

async function git(directory: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: directory, maxBuffer: 256 * 1024 * 1024 });
  return stdout;
}

async function submodulePaths(root: string): Promise<Set<string>> {
  const listing = await git(root, ["ls-files", "--stage", "-z"]);
  const paths = listing
    .split("\0")
    .filter((entry) => entry.startsWith("160000"))
    .map((entry) => entry.slice(entry.indexOf("\t") + 1));
  return new Set(paths);
}

async function statusChanges(root: string): Promise<StatusChange[]> {
  const output = await git(root, ["status", "--porcelain", "-z", "--untracked-files=all"]);
  const fields = output.split("\0");
  const changes: StatusChange[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index] ?? "";
    if (field.length < 4) continue;
    const status = field.slice(0, 2);
    const filePath = field.slice(3);
    if (status.includes("R") || status.includes("C")) {
      const origin = fields[(index += 1)] ?? "";
      if (status.includes("R") && origin) changes.push({ path: origin, deleted: true });
    }
    changes.push({ path: filePath, deleted: status.includes("D") });
  }
  return changes;
}

async function overlay(root: string, directory: string, changes: StatusChange[]): Promise<string[]> {
  const submodules = await submodulePaths(root);
  const overlaid: string[] = [];
  for (const change of changes) {
    if (submodules.has(change.path)) continue;
    const target = path.join(directory, change.path);
    const source = path.join(root, change.path);
    const sourceStats = await lstat(source).catch(() => undefined);
    if (change.deleted && !sourceStats) await rm(target, { recursive: true, force: true });
    else if (sourceStats && !sourceStats.isDirectory()) {
      await mkdir(path.dirname(target), { recursive: true });
      await rm(target, { recursive: true, force: true });
      await cp(source, target, { verbatimSymlinks: true });
    } else continue;
    overlaid.push(change.path);
  }
  return overlaid;
}

export async function prepareWorkingTree(root: string, revision?: string): Promise<PreparedWorkingTree> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "agent-evals-tree-"));
  try {
    await git(root, ["worktree", "add", "--detach", directory, revision ?? "HEAD"]);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  const dispose = async () => {
    await git(root, ["worktree", "remove", "--force", directory]).catch(() => undefined);
    await rm(directory, { recursive: true, force: true });
    await git(root, ["worktree", "prune"]).catch(() => undefined);
  };
  try {
    const overlaidPaths = revision === undefined ? await overlay(root, directory, await statusChanges(root)) : [];
    const commit = (await git(directory, ["rev-parse", "HEAD"])).trim();
    return { directory, overlaidPaths, commit, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}
