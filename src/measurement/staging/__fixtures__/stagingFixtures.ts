import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { EnvironmentDeclaration, InstructionCase } from "../../../domain/cases.js";
import type { ProjectConfig } from "../../../domain/project.js";
import type { StagingRequest } from "../../../domain/ports.js";

export function git(directory: string, ...args: string[]): string {
  return execFileSync(
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
      ...args,
    ],
    {
      cwd: directory,
      encoding: "utf8",
    },
  ).trim();
}

export function writeTree(root: string, files: Record<string, string>): void {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}

export function createSourceRepository(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "staging-source-"));
  git(root, "init", "--quiet", "-b", "main");
  writeTree(root, files);
  git(root, "add", "--all");
  git(root, "commit", "--quiet", "-m", "base");
  return root;
}

export function emptyEnvironment(overrides: Partial<EnvironmentDeclaration> = {}): EnvironmentDeclaration {
  return { git: false, files: [], layers: [], adjustments: {}, removals: {}, plugins: [], ...overrides };
}

export function buildConfig(overrides: Partial<ProjectConfig> = {}): ProjectConfig {
  return {
    discovery: { instructions: ["CLAUDE.md", "AGENTS.md"], ignore: [] },
    subject: { canonicalClient: "claude", environment: {} },
    ...overrides,
  } as ProjectConfig;
}

export function buildCase(overrides: Partial<InstructionCase> = {}): InstructionCase {
  return {
    type: "instruction",
    category: "c",
    name: "n",
    level: "integration",
    sourceFile: "x.yaml",
    pending: false,
    heldOut: false,
    instruction: "skills/demo/SKILL.md",
    extraInstructions: [],
    prompt: "p",
    models: {},
    writes: false,
    assertions: {} as InstructionCase["assertions"],
    ...overrides,
  };
}

export function buildRequest(sourceRoot: string, overrides: Partial<StagingRequest> = {}): StagingRequest {
  return {
    config: buildConfig(),
    evalCase: buildCase(),
    client: "claude",
    sourceRoot,
    variantPlugins: [],
    variantEnvironment: {},
    ...overrides,
  };
}
