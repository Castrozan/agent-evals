import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { McpCase } from "../domain/cases.js";
import { makeCase, makeConfig } from "../verdict/__fixtures__/builders.js";
import { cliCase, fakeClient, fixture, stager, usage } from "./__fixtures__/fakes.js";
import { executeRun } from "./executeRun.js";
import { journalPathFor } from "./journal.js";
import { createInProcessExecutor } from "./modelCaseExecutor.js";

describe("executeRun", () => {
  async function setup() {
    const base = await mkdtemp(path.join(os.tmpdir(), "run-"));
    const config = makeConfig({ root: base, repetitionsByLevel: { unit: 2, integration: 1, "end-to-end": 1 } });
    const client = fakeClient((invocation) =>
      invocation.prompt.includes("## Critério")
        ? "VEREDITO: PASS"
        : invocation.systemPrompt
          ? "com instrucao"
          : "sem instrucao",
    );
    const clients = () => client;
    const runtime = {
      config,
      profile: { subject: { client: "claude" as const, model: "m" }, judge: { client: "claude" as const, model: "j" } },
      sourceRoot: base,
      variantPlugins: [],
      variantEnvironment: {},
      clients,
      stager,
    };
    await mkdir(path.join(base, "evals"));
    await writeFile(path.join(base, "SKILL.md"), "---\nname: x\n---\ncorpo\n");
    const common = (overrides = {}) => ({
      config,
      profile: runtime.profile,
      clients,
      stager,
      executor: createInProcessExecutor(runtime),
      workingTreeDirectory: base,
      selection: { categories: [], cases: [], affected: false, partial: false },
      resume: false,
      paired: false,
      repetitionsMultiplier: 1,
      dryRun: false,
      write: () => undefined,
      runsDirectory: path.join(base, "runs"),
      journalPath: journalPathFor(base, base),
      ...overrides,
    });
    return { base, common, client };
  }

  it("runs cases, records samples and writes the run record", async () => {
    const { base, common } = await setup();
    const lines: string[] = [];
    const outcome = await executeRun({
      ...common({ write: (line: string) => lines.push(line) }),
      cases: [makeCase("c", "n", { instruction: "SKILL.md" }), cliCase()],
    });
    if (outcome.kind !== "record") throw new Error("esperado registro");
    const { record } = outcome;
    expect(record.cases[0]?.samples).toHaveLength(2);
    expect(record.cases[0]?.samples.every((sample) => sample.passed)).toBe(true);
    expect(record.cases[1]?.samples[0]?.passed).toBe(true);
    expect(record.instrument.sdks.claude).toBe("9.9");
    expect(Object.keys(record.instructionFingerprints)).toEqual(["SKILL.md"]);
    expect(record.invalid).toBeUndefined();
    expect(lines.length).toBeGreaterThan(0);
    const runs = path.join(base, "runs");
    const directory = path.join(runs, readdirOne(runs));
    expect(readFileSync(path.join(directory, "results.jsonl"), "utf8").trim().split("\n")).toHaveLength(3);
    expect(existsSync(journalPathFor(base, base))).toBe(false);
  });

  it("returns the plan on a dry run without calling anything", async () => {
    const { common, client } = await setup();
    const outcome = await executeRun({ ...common({ dryRun: true }), cases: [makeCase("c", "n")] });
    expect(outcome.kind).toBe("plan");
    expect(client.invocations).toHaveLength(0);
  });

  it("flags a case that lost every sample as invalid", async () => {
    const { common } = await setup();
    const failing = {
      ...fakeClient(() => ""),
      run: async () => ({
        text: "",
        skillsUsed: [],
        toolsUsed: [],
        commandsRun: [],
        tokenUsage: usage,
        toolOutputCharacters: 0,
        durationMs: 1,
        instrumentFailure: { kind: "timeout" as const, message: "t" },
      }),
    };
    const outcome = await executeRun({
      ...common({
        clients: () => failing,
        executor: createInProcessExecutor({
          config: makeConfig(),
          profile: { subject: { client: "claude", model: "m" }, judge: { client: "claude" } },
          sourceRoot: "/",
          variantPlugins: [],
          variantEnvironment: {},
          clients: () => failing,
          stager,
        }),
      }),
      cases: [makeCase("c", "n")],
    });
    expect(outcome.kind === "record" && outcome.record.invalid).toBeTruthy();
  });

  it("runs a paired control without the instruction surface", async () => {
    const { common } = await setup();
    const outcome = await executeRun({
      ...common({ paired: true }),
      cases: [
        makeCase("c", "n", {
          instruction: "SKILL.md",
          assertions: { ...makeCase("c", "n").assertions, judge: [], contains: ["com instrucao"] },
        }),
      ],
    });
    if (outcome.kind !== "record") throw new Error("esperado registro");
    const control = outcome.record.cases[0]?.pairedControl;
    expect(control).toMatchObject({ withoutInstructionPasses: 0, withoutInstructionSamples: 2 });
    expect(outcome.record.cases[0]?.samples.every((sample) => sample.passed)).toBe(true);
  });

  it("resumes from the journal only when the fingerprint matches", async () => {
    const { common, client, base } = await setup();
    const evalCase = makeCase("c", "n", { instruction: "SKILL.md" });
    const journalPath = journalPathFor(base, base);
    const failing = fakeClient(() => "");
    failing.run = async () => {
      throw new Error("queda");
    };
    await expect(executeRun({ ...common({ clients: () => failing }), cases: [evalCase] })).resolves.toBeDefined();
    await executeRun({ ...common({ resume: true }), cases: [evalCase] });
    expect(client.invocations.length).toBeGreaterThan(0);
    expect(existsSync(journalPath)).toBe(false);
  });
});

function readdirOne(directory: string): string {
  return readdirSync(directory)[0]!;
}
