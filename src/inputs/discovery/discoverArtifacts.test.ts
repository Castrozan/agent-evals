import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectConfig } from "../configuration/loadProjectConfig.js";
import type { EvalCase } from "../../domain/cases.js";
import { computeCoverage } from "./coverage.js";
import { discoverArtifacts } from "./discoverArtifacts.js";

let root: string;

function write(relativePath: string, content: string, mode = 0o644): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, { mode });
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "discovery-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function populate(): void {
  write("CLAUDE.md", "# x");
  write("skills/deploy/SKILL.md", "---\nname: deploy\n---");
  write("plugin/commands/build.md", "x");
  write("plugin/commands/nested/skipped.md", "x");
  write("docs/workflows/release.md", "x");
  write("agents/helper.md", "x");
  write("evals/skills/SKILL.md", "x");
  write("node_modules/dep/SKILL.md", "x");
  write("vendor/SKILL.md", "x");
  write("package.json", JSON.stringify({ name: "@scope/tool", bin: { tool: "bin/tool.js" } }));
  write("bin/tool.js", "");
  write("scripts/run.sh", "");
  write("scripts/helper.py", "");
  write("scripts/README.md", "");
  write("tools/native", "", 0o755);
  write(
    "pyproject.toml",
    '[project]\nname = "x"\n\n[project.scripts]\npytool = "pkg.main:run"  # note\n\n[tool.other]\nnope = "1"\n',
  );
  write(".mcp.json", JSON.stringify({ mcpServers: { files: { command: "node", args: ["s.js"] } } }));
  write("evals/config.yaml", "descoberta: {ignorar: ['vendor/**']}\n");
}

describe("discoverArtifacts", () => {
  it("finds instructions, CLIs and MCP servers, honoring ignore and excluding evals", () => {
    populate();
    const artifacts = discoverArtifacts(loadProjectConfig(root));
    const summary = artifacts.map((artifact) => `${artifact.kind}:${artifact.path}:${artifact.name}`);
    expect(summary).toEqual([
      "instruction:CLAUDE.md:CLAUDE",
      "instruction:agents/helper.md:helper",
      "instruction:docs/workflows/release.md:release",
      "instruction:plugin/commands/build.md:build",
      "instruction:skills/deploy/SKILL.md:deploy",
      "cli:bin/tool.js:tool",
      "cli:pyproject.toml:pytool",
      "cli:scripts/helper.py:helper",
      "cli:scripts/run.sh:run",
      "cli:tools/native:native",
      "mcp:.mcp.json:files",
    ]);
    expect(artifacts.find((artifact) => artifact.name === "run")?.interpreter).toBe("bash");
    expect(artifacts.find((artifact) => artifact.kind === "mcp")?.serverCommand).toEqual(["node", "s.js"]);
  });
});

describe("computeCoverage", () => {
  it("matches instructions by path or glob, CLIs by command and MCP by server name", () => {
    populate();
    const artifacts = discoverArtifacts(loadProjectConfig(root));
    const base = { level: "unit", sourceFile: "x", heldOut: false } as const;
    const assertions = {
      judge: [],
      equals: [],
      contains: [],
      notContains: [],
      regex: [],
      notRegex: [],
      skillsUsed: [],
      skillsForbidden: [],
      toolsUsed: [],
      toolsForbidden: [],
      commandsRun: [],
      commandsRunForbidden: [],
      generatedFiles: [],
      commands: [],
      judgeOnCommand: [],
    };
    const cases: EvalCase[] = [
      {
        ...base,
        type: "instruction",
        category: "c",
        name: "skill",
        pending: false,
        instruction: "skills/deploy/SKILL.md",
        extraInstructions: ["agents/*.md"],
        prompt: "p",
        models: {},
        writes: false,
        assertions,
      },
      {
        ...base,
        type: "instruction",
        category: "c",
        name: "pend",
        pending: true,
        instruction: "CLAUDE.md",
        extraInstructions: [],
        prompt: "",
        models: {},
        writes: false,
        assertions,
      },
      {
        ...base,
        type: "cli",
        category: "c",
        name: "help",
        pending: false,
        command: "./scripts/run.sh --help",
        exitCode: 0,
        assertions,
      },
      {
        ...base,
        type: "cli",
        category: "c",
        name: "bin",
        pending: false,
        command: "pytool --help",
        exitCode: 0,
        assertions,
      },
      {
        ...base,
        type: "mcp",
        category: "c",
        name: "srv",
        pending: false,
        server: { name: "files", command: [], environment: {} },
        contract: [],
        strict: false,
        calls: [],
      },
    ];
    const coverage = Object.fromEntries(
      computeCoverage(artifacts, cases).map((entry) => [entry.artifact.path, entry.coveredBy]),
    );
    expect(coverage).toMatchObject({
      "skills/deploy/SKILL.md": ["c/skill"],
      "agents/helper.md": ["c/skill"],
      "CLAUDE.md": [],
      "scripts/run.sh": ["c/help"],
      "pyproject.toml": ["c/bin"],
      "bin/tool.js": [],
      ".mcp.json": ["c/srv"],
    });
  });
});
