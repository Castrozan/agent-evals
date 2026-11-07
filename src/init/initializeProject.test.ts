import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCases } from "../cases/loadCases.js";
import { loadProjectConfig } from "../configuration/loadProjectConfig.js";
import { computeCoverage } from "../discovery/coverage.js";
import { discoverArtifacts } from "../discovery/discoverArtifacts.js";
import { initializeProject } from "./initializeProject.js";

const fixture = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "mcp", "__fixtures__", "echoServer.mjs");

let root: string;

function write(relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "init-"));
  write("CLAUDE.md", "# regras\n");
  write("scripts/run.sh", "echo ok\n");
  write(".mcp.json", JSON.stringify({ mcpServers: { echo: { command: process.execPath, args: [fixture] } } }));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("initializeProject", () => {
  it("seeds config, pending instruction case, CLI smoke case, MCP contract and CI workflow", async () => {
    const summary = await initializeProject(root);
    expect(summary.created.sort()).toEqual([
      ".github/workflows/evals.yml",
      "evals/casos/cli/scripts-run-sh-run.yaml",
      "evals/casos/instrucoes/claude-md.yaml",
      "evals/casos/mcp/echo.yaml",
      "evals/config.yaml",
    ]);

    const config = loadProjectConfig(root);
    const cases = loadCases(config);
    expect(cases.find((evalCase) => evalCase.type === "instruction")).toMatchObject({
      pending: true,
      instruction: "CLAUDE.md",
    });
    expect(cases.find((evalCase) => evalCase.type === "cli")).toMatchObject({
      command: "bash scripts/run.sh --help",
      exitCode: 0,
    });
    expect(cases.find((evalCase) => evalCase.type === "mcp")).toMatchObject({
      contract: [
        { name: "echo", required: ["text"] },
        { name: "ping", required: [] },
      ],
    });
    const workflow = fs.readFileSync(path.join(root, ".github/workflows/evals.yml"), "utf8");
    expect(workflow).toContain("Castrozan/agent-evals/.github/workflows/check.yml@main");
    expect(workflow).toContain("Castrozan/agent-evals/.github/workflows/pages.yml@main");

    const coverage = computeCoverage(discoverArtifacts(config), cases);
    expect(coverage.filter((entry) => entry.coveredBy.length > 0).map((entry) => entry.artifact.kind)).toEqual([
      "cli",
      "mcp",
    ]);
  });

  it("is idempotent and never overwrites existing files", async () => {
    await initializeProject(root);
    write("evals/config.yaml", "projeto: custom\ncasos: [evals/casos/**/*.yaml]\n");
    const second = await initializeProject(root);
    expect(second.created).toEqual([]);
    expect(second.skipped.map((entry) => entry.path).sort()).toEqual([
      ".github/workflows/evals.yml",
      "evals/config.yaml",
    ]);
    expect(fs.readFileSync(path.join(root, "evals/config.yaml"), "utf8")).toContain("custom");
  });

  it("skips an unreachable MCP server with a reason", async () => {
    write(".mcp.json", JSON.stringify({ mcpServers: { dead: { command: "/nonexistent-binary" } } }));
    const summary = await initializeProject(root);
    expect(summary.skipped).toContainEqual({
      path: ".mcp.json#dead",
      reason: expect.stringContaining("servidor MCP indisponível"),
    });
  });
});
