import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { InstructionCase } from "../../domain/cases.js";
import { makeCase, makeConfig } from "../../verdict/__fixtures__/builders.js";
import { createPromptfooExecutor, PROMPTFOO_BINARY_VARIABLE } from "./promptfooExecutor.js";

async function fakePromptfoo(script: string): Promise<{ binary: string; log: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fake-promptfoo-"));
  const binary = path.join(directory, "promptfoo");
  const log = path.join(directory, "calls.log");
  await writeFile(binary, `#!/bin/sh\nLOG=${log}\n${script}\n`);
  await chmod(binary, 0o755);
  return { binary, log };
}

const settings = {
  config: makeConfig(),
  profile: { subject: { client: "claude" as const, model: "haiku" }, judge: { client: "claude" as const } },
  sourceRoot: os.tmpdir(),
  variantPlugins: [],
  variantEnvironment: {},
};

afterEach(() => {
  delete process.env[PROMPTFOO_BINARY_VARIABLE];
});

describe("promptfoo executor", () => {
  it("splits large batches across runs with private state and turns a crashed run into instrument failures", async () => {
    const { binary, log } = await fakePromptfoo(
      [
        'if [ "$1" = "--version" ]; then echo 0.118.14; exit 0; fi',
        'echo "$PROMPTFOO_CONFIG_DIR" >> "$LOG"',
        'echo "native teardown aborted" >&2',
        "exit 134",
      ].join("\n"),
    );
    process.env[PROMPTFOO_BINARY_VARIABLE] = binary;
    const evalCase = makeCase("categoria", "caso") as InstructionCase;
    const requests = Array.from({ length: 45 }, (_, index) => ({ evalCase, repetition: index + 1, control: false }));
    const seen: number[] = [];
    const executor = createPromptfooExecutor({ compositionModuleUrl: "file:///nowhere.js" });

    const samples = await executor.execute(settings, requests, {
      concurrency: 2,
      onSample: (request) => seen.push(request.repetition),
    });

    const stateDirectories = (await readFile(log, "utf8")).trim().split("\n");
    expect(stateDirectories).toHaveLength(2);
    expect(new Set(stateDirectories).size).toBe(2);
    expect(samples).toHaveLength(45);
    expect(samples.every((sample) => sample.instrumentFailure?.kind === "client-error")).toBe(true);
    expect(samples[0]?.instrumentFailure?.message).toContain("native teardown aborted");
    expect(seen).toHaveLength(45);
  });

  it("recovers the samples that finished before promptfoo died", async () => {
    const recovered = JSON.stringify({ caseKey: "categoria/caso", repetition: 1, passed: true, assertions: [] });
    const { binary } = await fakePromptfoo(
      [
        'if [ "$1" = "--version" ]; then echo 0.118.14; exit 0; fi',
        'job_directory=$(dirname "$3")',
        'mkdir -p "$job_directory/samples"',
        `echo '${recovered}' > "$job_directory/samples/0.json"`,
        "exit 134",
      ].join("\n"),
    );
    process.env[PROMPTFOO_BINARY_VARIABLE] = binary;
    const evalCase = makeCase("categoria", "caso") as InstructionCase;
    const requests = [1, 2].map((repetition) => ({ evalCase, repetition, control: false }));
    const executor = createPromptfooExecutor({ compositionModuleUrl: "file:///nowhere.js" });

    const samples = await executor.execute(settings, requests, { concurrency: 1 });

    expect(samples[0]?.passed).toBe(true);
    expect(samples[0]?.instrumentFailure).toBeUndefined();
    expect(samples[1]?.instrumentFailure?.message).toContain("sem gravar resultados");
  });
});
