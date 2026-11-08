import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Baseline } from "../../domain/baseline.js";

function gitOutput(root: string, gitArguments: string[]): string | undefined {
  try {
    return execFileSync("git", gitArguments, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return undefined;
  }
}

function baselineAtCommit(root: string, commit: string, relativePath: string): Baseline | undefined {
  const content = gitOutput(root, ["show", `${commit}:${relativePath}`]);
  return content === undefined ? undefined : (JSON.parse(content) as Baseline);
}

export function previousCommittedBaseline(root: string, baselinePath: string): Baseline | undefined {
  const relativePath = path.relative(root, path.resolve(root, baselinePath)).split(path.sep).join("/");
  const commits = (gitOutput(root, ["log", "--format=%H", "-n", "2", "--", relativePath]) ?? "")
    .split("\n")
    .filter(Boolean);
  const headContent = gitOutput(root, ["show", `HEAD:${relativePath}`]);
  const workingContent = fs.existsSync(path.resolve(root, relativePath))
    ? fs.readFileSync(path.resolve(root, relativePath), "utf8")
    : undefined;
  const workingCopyChanged = headContent !== undefined && workingContent !== headContent;
  const previousCommit = workingCopyChanged ? commits[0] : commits[1];
  return previousCommit === undefined ? undefined : baselineAtCommit(root, previousCommit, relativePath);
}
