import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createSourceRepository, git, writeTree } from "../staging/__fixtures__/stagingFixtures.js";
import { detectLeakedSkills } from "./userSkills.js";
import { prepareWorkingTree } from "./workingTree.js";

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()?.();
});

describe("prepareWorkingTree", () => {
  it("overlays modified, untracked and deleted paths onto a worktree at HEAD", async () => {
    const root = createSourceRepository({
      "keep.txt": "k",
      "edit.txt": "antes",
      "gone.txt": "g",
      "dir/inner.txt": "i",
    });
    writeTree(root, { "edit.txt": "depois", "novo/arquivo.txt": "n" });
    rmSync(path.join(root, "gone.txt"));
    const tree = await prepareWorkingTree(root);
    cleanups.push(tree.dispose);
    expect(readFileSync(path.join(tree.directory, "edit.txt"), "utf8")).toBe("depois");
    expect(readFileSync(path.join(tree.directory, "novo/arquivo.txt"), "utf8")).toBe("n");
    expect(existsSync(path.join(tree.directory, "gone.txt"))).toBe(false);
    expect(existsSync(path.join(tree.directory, "keep.txt"))).toBe(true);
    expect([...tree.overlaidPaths].sort()).toEqual(["edit.txt", "gone.txt", "novo/arquivo.txt"]);
    expect(tree.commit).toBe(git(root, "rev-parse", "HEAD"));
    expect(readFileSync(path.join(root, "edit.txt"), "utf8")).toBe("depois");
  });

  it("measures a given revision without overlay", async () => {
    const root = createSourceRepository({ "a.txt": "um" });
    const first = git(root, "rev-parse", "HEAD");
    writeTree(root, { "a.txt": "dois" });
    git(root, "commit", "--quiet", "-am", "dois");
    writeTree(root, { "a.txt": "sujo" });
    const tree = await prepareWorkingTree(root, first);
    cleanups.push(tree.dispose);
    expect(readFileSync(path.join(tree.directory, "a.txt"), "utf8")).toBe("um");
    expect(tree.overlaidPaths).toEqual([]);
    expect(tree.commit).toBe(first);
  });

  it("excludes submodules from the overlay and removes the worktree on dispose", async () => {
    const inner = createSourceRepository({ "i.txt": "i" });
    const root = createSourceRepository({ "a.txt": "a" });
    git(root, "-c", "protocol.file.allow=always", "submodule", "add", "--quiet", inner, "mod");
    git(root, "commit", "--quiet", "-m", "submodule");
    writeTree(path.join(root, "mod"), { "dirty.txt": "x" });
    const tree = await prepareWorkingTree(root);
    expect(tree.overlaidPaths).toEqual([]);
    await tree.dispose();
    expect(existsSync(tree.directory)).toBe(false);
    expect(git(root, "worktree", "list").split("\n")).toHaveLength(1);
  });
});

describe("detectLeakedSkills", () => {
  it("returns visible skills that live in the client's user skill directory", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "home-"));
    mkdirSync(path.join(home, ".codex/skills/personal"), { recursive: true });
    writeFileSync(path.join(home, ".codex/skills/personal/SKILL.md"), "");
    mkdirSync(path.join(home, ".claude/skills/other"), { recursive: true });
    writeFileSync(path.join(home, ".claude/skills/other/SKILL.md"), "");
    mkdirSync(path.join(home, ".codex/skills/not-a-skill"), { recursive: true });
    expect(detectLeakedSkills("codex", ["personal", "demo", "other", "not-a-skill"], home)).toEqual(["personal"]);
    expect(detectLeakedSkills("claude", ["personal", "other"], home)).toEqual(["other"]);
    expect(detectLeakedSkills("opencode", ["personal"], home)).toEqual([]);
  });

  it("flags skills delivered by an installed plugin, named with or without the plugin prefix", () => {
    const home = mkdtempSync(path.join(os.tmpdir(), "home-"));
    const pluginSkill = path.join(home, ".claude/plugins/cache/market/toolkit/1.0.0/skills/review");
    mkdirSync(pluginSkill, { recursive: true });
    writeFileSync(path.join(pluginSkill, "SKILL.md"), "");
    expect(detectLeakedSkills("claude", ["toolkit:review", "staged-skill"], home)).toEqual(["toolkit:review"]);
  });
});
