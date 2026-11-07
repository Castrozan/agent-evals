import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { McpCase } from "../../domain/cases.js";
import { makeCase, makeConfig } from "../../verdict/__fixtures__/builders.js";
import { cliCase, fakeClient, fixture, stager, usage } from "../__fixtures__/fakes.js";
import { runCliSample } from "./cliSample.js";
import { buildInvocation } from "./instructionSample.js";
import { stripFrontmatter } from "./instructionSurface.js";
import { runMcpSample } from "./mcpSample.js";
import { buildPromptfooConfig, providerModuleSource, readSamples } from "../promptfoo/promptfooExecutor.js";
import { repetitionsFor } from "../run/repetitions.js";

describe("cli and mcp runners", () => {
  it("runs a cli case with stdin and exit code", async () => {
    const runtime = {
      config: makeConfig(),
      profile: { subject: { client: "claude" as const, model: "m" }, judge: { client: "claude" as const } },
      sourceRoot: os.tmpdir(),
      stager,
      variantPlugins: [],
      variantEnvironment: {},
    };
    expect((await runCliSample(cliCase(), runtime)).passed).toBe(true);
    expect((await runCliSample(cliCase({ exitCode: 2 }), runtime)).passed).toBe(false);
    expect((await runCliSample(cliCase({ command: "sleep 5", timeoutSeconds: 0.1 }), runtime)).passed).toBe(false);
  });

  it("checks the mcp contract and calls", async () => {
    const base: McpCase = {
      category: "mcp",
      name: "eco",
      level: "unit",
      sourceFile: "x",
      pending: false,
      heldOut: false,
      type: "mcp",
      server: { name: "echo", command: [process.execPath, fixture], environment: {} },
      contract: [{ name: "echo", required: ["text"] }],
      strict: false,
      calls: [{ tool: "echo", arguments: { text: "olá" }, contains: ["OLÁ"] }],
    };
    expect((await runMcpSample(base, os.tmpdir(), 10)).passed).toBe(true);
    expect(
      (await runMcpSample({ ...base, contract: [{ name: "missing", required: [] }] }, os.tmpdir(), 10)).passed,
    ).toBe(false);
    expect(
      (await runMcpSample({ ...base, contract: [{ name: "echo", required: ["text", "extra"] }] }, os.tmpdir(), 10))
        .passed,
    ).toBe(false);
    expect((await runMcpSample({ ...base, strict: true }, os.tmpdir(), 10)).passed).toBe(false);
  });
});

describe("repetitions and surface", () => {
  it("prefers case override then level default, scaled by the multiplier", () => {
    const config = makeConfig({ repetitionsByLevel: { unit: 3, integration: 1, "end-to-end": 1 } });
    expect(repetitionsFor(config, makeCase("a", "b"), 1)).toBe(3);
    expect(repetitionsFor(config, makeCase("a", "b", { repetitions: 2 }), 2)).toBe(4);
  });
  it("strips frontmatter", () => {
    expect(stripFrontmatter("---\nname: x\n---\ncorpo\n")).toBe("corpo");
  });
  it("builds unit and integration invocations", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "surface-"));
    await writeFile(path.join(root, "SKILL.md"), "---\nname: x\n---\ncorpo da skill\n");
    const runtime = {
      config: makeConfig(),
      profile: { subject: { client: "claude" as const, model: "m" }, judge: { client: "claude" as const } },
      sourceRoot: root,
      variantPlugins: [],
      variantEnvironment: {},
      clients: () => fakeClient(() => ""),
      stager,
    };
    const staged = await stager.stage();
    const unit = buildInvocation(
      makeCase("a", "b", { instruction: "SKILL.md", systemPrompt: "extra" }),
      runtime,
      staged,
    );
    expect(unit).toMatchObject({ posture: "none", systemPrompt: "corpo da skill\n\nextra" });
    const integration = buildInvocation(makeCase("a", "b", { level: "integration" }), runtime, staged);
    expect(integration.posture).toBe("read-only");
    expect(buildInvocation(makeCase("a", "b", { level: "integration", writes: true }), runtime, staged).posture).toBe(
      "write",
    );
  });
});

describe("promptfoo orchestration", () => {
  it("generates config and provider and reads results back", () => {
    const requests = [{ evalCase: makeCase("a", "b"), repetition: 1, control: false }];
    const config = buildPromptfooConfig(requests, "/tmp/p.mjs", "/tmp/j.json", 3) as {
      tests: unknown[];
      evaluateOptions: { maxConcurrency: number };
    };
    expect(config.tests).toHaveLength(1);
    expect(config.evaluateOptions.maxConcurrency).toBe(3);
    expect(providerModuleSource("file:///x/jobSample.js")).toContain("runJobSample");
    const sample = {
      caseKey: "a/b",
      repetition: 1,
      passed: true,
      assertions: [],
      output: "o",
      tokenUsage: usage,
      toolOutputCharacters: 0,
      durationMs: 1,
    };
    const results = JSON.stringify({
      results: { results: [{ vars: { jobIndex: 0 }, response: { metadata: { sample } } }] },
    });
    expect(readSamples(results, requests)[0]).toEqual(sample);
  });
});
