import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { makeBaseline, makeCase, makeEntry } from "../../evidence/verdict/__fixtures__/builders.js";
import { selectAffectedCases } from "./affected.js";
import { caseFingerprint } from "./case.js";
import { hashDirectoryTree } from "./files.js";
import { instructionFingerprints } from "./instructions.js";

function workspace(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "fingerprint-"));
  mkdirSync(path.join(root, "skills/a"), { recursive: true });
  mkdirSync(path.join(root, "skills/b"), { recursive: true });
  mkdirSync(path.join(root, "tree/.git"), { recursive: true });
  writeFileSync(path.join(root, "skills/a/SKILL.md"), "alpha");
  writeFileSync(path.join(root, "skills/b/SKILL.md"), "beta");
  writeFileSync(path.join(root, "tree/file.txt"), "one");
  writeFileSync(path.join(root, "tree/.git/HEAD"), "ref");
  writeFileSync(path.join(root, "reference.txt"), "ref-v1");
  return root;
}

describe("directory tree hashing", () => {
  it("skips .git and reacts to content and path changes", () => {
    const root = workspace();
    const before = hashDirectoryTree(path.join(root, "tree"));
    writeFileSync(path.join(root, "tree/.git/HEAD"), "other");
    expect(hashDirectoryTree(path.join(root, "tree"))).toBe(before);
    writeFileSync(path.join(root, "tree/file.txt"), "two");
    expect(hashDirectoryTree(path.join(root, "tree"))).not.toBe(before);
  });
});

describe("case fingerprint", () => {
  it("changes with instruction content, extras globs, trees and reference files", () => {
    const root = workspace();
    const base = makeCase("c", "a", { instruction: "skills/a/SKILL.md", extraInstructions: ["skills/b/*.md"] });
    const reference = (value: string) =>
      makeCase("c", "a", {
        instruction: "skills/a/SKILL.md",
        assertions: { ...base.assertions, judgeOnCommand: [{ run: "x", reference: value, rubric: ["r"] }] },
      });
    const initial = caseFingerprint(base, root);
    expect(caseFingerprint(base, root)).toBe(initial);
    const initialReference = caseFingerprint(reference("reference.txt"), root);
    writeFileSync(path.join(root, "skills/b/SKILL.md"), "beta2");
    expect(caseFingerprint(base, root)).not.toBe(initial);
    writeFileSync(path.join(root, "reference.txt"), "ref-v2");
    expect(caseFingerprint(reference("reference.txt"), root)).not.toBe(initialReference);

    const withTree = makeCase("c", "a", {
      environment: {
        git: false,
        files: [],
        layers: [{ from: "tree" }],
        adjustments: {},
        removals: {},
        plugins: [{ copy: ["tree"], files: [] }],
      },
    });
    const treeBefore = caseFingerprint(withTree, root);
    writeFileSync(path.join(root, "tree/file.txt"), "changed");
    expect(caseFingerprint(withTree, root)).not.toBe(treeBefore);
  });

  it("ignores the source file but not the definition", () => {
    const root = workspace();
    const first = makeCase("c", "a");
    expect(caseFingerprint({ ...first, sourceFile: "elsewhere.yaml" }, root)).toBe(caseFingerprint(first, root));
    expect(caseFingerprint({ ...first, prompt: "outra" }, root)).not.toBe(caseFingerprint(first, root));
  });

  it("maps instruction files of a set of cases", () => {
    const root = workspace();
    const cases = [
      makeCase("c", "a", { instruction: "skills/a/SKILL.md", extraInstructions: ["skills/*/SKILL.md"] }),
      makeCase("c", "cli", { type: "cli" } as never),
    ];
    expect(Object.keys(instructionFingerprints(cases, root))).toEqual(["skills/a/SKILL.md", "skills/b/SKILL.md"]);
  });
});

describe("affected selection", () => {
  const now = new Date("2026-11-07T00:00:00.000Z");
  const baseline = makeBaseline([
    makeEntry("c", "same", [true]),
    makeEntry("c", "changed", [true]),
    makeEntry("c", "old", [true], { measuredAt: "2026-08-01T00:00:00.000Z" }),
  ]);
  it("selects changed, missing and expired cases", () => {
    const candidates = ["same", "changed", "old", "new"].map((name) => ({
      caseKey: `c/${name}`,
      fingerprint: name === "changed" ? "different" : "fp",
    }));
    expect(selectAffectedCases(candidates, baseline, now, 30).map((candidate) => candidate.caseKey)).toEqual([
      "c/changed",
      "c/old",
      "c/new",
    ]);
    expect(selectAffectedCases(candidates, undefined, now, 30)).toHaveLength(4);
  });
});
