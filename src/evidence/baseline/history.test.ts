import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { previousCommittedBaseline } from "./history.js";

function git(root: string, ...gitArguments: string[]): void {
  execFileSync(
    "git",
    [
      "-c",
      "user.name=t",
      "-c",
      "user.email=t@t",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      ...gitArguments,
    ],
    { cwd: root, stdio: "ignore" },
  );
}

function commitBaseline(root: string, recordedAt: string): void {
  fs.writeFileSync(path.join(root, "evals/baseline.json"), JSON.stringify({ recordedAt }));
  git(root, "add", "evals/baseline.json");
  git(root, "commit", "-m", recordedAt);
}

describe("previousCommittedBaseline", () => {
  it("returns the commit before HEAD when the working copy is unchanged", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "historico-"));
    fs.mkdirSync(path.join(root, "evals"));
    git(root, "init", "-q");
    commitBaseline(root, "primeira");
    commitBaseline(root, "segunda");
    expect(previousCommittedBaseline(root, "evals/baseline.json")?.recordedAt).toBe("primeira");
    fs.writeFileSync(path.join(root, "evals/baseline.json"), JSON.stringify({ recordedAt: "terceira" }));
    expect(previousCommittedBaseline(root, "evals/baseline.json")?.recordedAt).toBe("segunda");
  });

  it("returns nothing outside git history", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "historico-"));
    expect(previousCommittedBaseline(root, "evals/baseline.json")).toBeUndefined();
  });
});
