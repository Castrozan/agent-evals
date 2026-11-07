import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  makeBaseline,
  makeCaseResult,
  makeConfig,
  makeEntry,
  makeRun,
  makeSample,
} from "../verdict/__fixtures__/builders.js";
import { runRecordToEntries } from "./entries.js";
import { mergeBaseline } from "./merge.js";
import { resolveBaselinePath } from "./paths.js";
import { readBaseline, writeBaseline } from "./storage.js";

const NOW = new Date("2026-11-07T00:00:00.000Z");

describe("baseline paths", () => {
  const config = makeConfig();
  it("places canonical, profile and variant baselines", () => {
    const location = { client: "codex" as const, profileId: "abc123" };
    expect(resolveBaselinePath(config, { ...location, canonical: true })).toBe("/repo/evals/baseline.json");
    expect(resolveBaselinePath(config, { ...location, canonical: false })).toBe(
      "/repo/evals/baseline-codex-abc123.json",
    );
    expect(resolveBaselinePath(config, { ...location, canonical: true, variant: "extra" })).toBe(
      "/repo/evals/baseline-extra.json",
    );
    expect(resolveBaselinePath(config, { ...location, canonical: false, variant: "extra" })).toBe(
      "/repo/evals/baseline-extra-codex-abc123.json",
    );
  });
});

describe("baseline storage", () => {
  it("returns undefined for a missing file, writes stable output and reads legacy files", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "baseline-"));
    const file = path.join(directory, "nested", "baseline.json");
    expect(readBaseline(file)).toBeUndefined();
    const baseline = makeBaseline([makeEntry("c", "b", [true]), makeEntry("c", "a", [false])]);
    writeBaseline(file, baseline);
    const text = readFileSync(file, "utf8");
    expect(text.endsWith("}\n")).toBe(true);
    expect(text.indexOf('"c/a"')).toBeLessThan(text.indexOf('"c/b"'));
    expect(readBaseline(file)).toEqual(baseline);
    const legacy = path.join(directory, "legacy.json");
    writeFileSync(legacy, JSON.stringify({ measurementContract: 1, recordedAt: "2026-01-01", cases: {} }));
    expect(readBaseline(legacy)?.profile).toBeUndefined();
    writeFileSync(legacy, "{");
    expect(() => readBaseline(legacy)).toThrow(/JSON inválido/);
  });
});

describe("run to entries", () => {
  it("uses only measured samples", () => {
    const failure = makeSample(false, { instrumentFailure: { kind: "timeout", message: "t" } });
    const run = makeRun([
      makeCaseResult("a", [makeSample(true), makeSample(false), failure], { instruction: "skills/a/SKILL.md" }),
      makeCaseResult("lost", [failure]),
    ]);
    const entries = runRecordToEntries(run);
    expect(Object.keys(entries)).toEqual(["c/a"]);
    expect(entries["c/a"]).toMatchObject({
      samples: 2,
      passes: 1,
      sampleOutcomes: [true, false],
      tokenTotals: [17, 17],
      toolOutputCharacters: [7, 7],
      costUsd: 1,
      measuredAt: run.finishedAt,
      heldOut: false,
      instruction: "skills/a/SKILL.md",
    });
  });
});

describe("merge", () => {
  const previous = makeBaseline(
    [makeEntry("c", "a", [true, true]), makeEntry("c", "b", [true]), makeEntry("c", "gone", [true])],
    { instructionFingerprints: { "x.md": "old" }, leakedSkills: ["s1"] },
  );
  const keys = ["c/a", "c/b", "c/new"];

  it("accumulates unchanged fingerprints, replaces changed ones, keeps others and prunes removed cases", () => {
    const run = makeRun(
      [
        makeCaseResult("a", [makeSample(false)]),
        makeCaseResult("b", [makeSample(false)], { fingerprint: "changed" }),
        makeCaseResult("new", [makeSample(true)]),
      ],
      {
        selection: { categories: [], cases: [], affected: true, partial: true },
        instructionFingerprints: { "y.md": "n" },
      },
    );
    const merged = mergeBaseline(previous, run, keys, NOW);
    expect(Object.keys(merged.cases).sort()).toEqual(["c/a", "c/b", "c/new"]);
    expect(merged.cases["c/a"]).toMatchObject({
      samples: 3,
      passes: 2,
      sampleOutcomes: [true, true, false],
      tokenTotals: [100, 100, 17],
    });
    expect(merged.cases["c/a"]!.costUsd).toBeCloseTo(0.52);
    expect(merged.cases["c/b"]).toMatchObject({ samples: 1, passes: 0, fingerprint: "changed" });
    expect(merged.instructionFingerprints).toEqual({ "x.md": "old", "y.md": "n" });
    expect(merged.leakedSkills).toEqual(["s1"]);
    expect(merged.recordedAt).toBe(NOW.toISOString());
  });

  it("keeps unmeasured cases with their dates on a filtered run", () => {
    const run = makeRun([makeCaseResult("a", [makeSample(true)])], {
      selection: { categories: ["c"], cases: [], affected: false, partial: true },
    });
    const merged = mergeBaseline(previous, run, keys, NOW);
    expect(merged.cases["c/b"]!.measuredAt).toBe("2026-11-01T00:00:00.000Z");
  });

  it("refuses invalid and partitioned runs", () => {
    expect(() => mergeBaseline(undefined, makeRun([], { invalid: { reason: "sem amostras" } }), [], NOW)).toThrow(
      /inválida/,
    );
    const partitioned = makeRun([], {
      selection: { categories: [], cases: [], affected: false, partition: "train", partial: true },
    });
    expect(() => mergeBaseline(undefined, partitioned, [], NOW)).toThrow(/partição/);
  });
});
