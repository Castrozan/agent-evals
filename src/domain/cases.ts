import type { ClientName } from "./clients.js";

export type CaseLevel = "unit" | "integration" | "end-to-end";

export type CaseType = "instruction" | "cli" | "mcp";

export type EnvironmentKind = "skill" | "package";

export interface StagedFile {
  path: string;
  content: string;
}

export interface RepositorySource {
  remote?: string;
  revision: string;
  branch?: string;
  exclude: string[];
}

export interface GitRepositoryDeclaration {
  directory: string;
  remote?: string;
}

export interface StagingLayer {
  from?: string;
  at?: string;
  git?: GitRepositoryDeclaration;
  repository?: RepositorySource;
}

export interface PluginDeclaration {
  name?: string;
  copy: string[];
  files: StagedFile[];
  repository?: RepositorySource;
  path?: string;
}

export interface EnvironmentDeclaration {
  git: boolean | GitRepositoryDeclaration[];
  instructions?: string[];
  files: StagedFile[];
  sessionIn?: string;
  layers: StagingLayer[];
  adjustments: Record<string, Record<string, unknown>>;
  removals: Record<string, string[]>;
  plugins: PluginDeclaration[];
}

export interface CommandCheck {
  run: string;
  regex?: string;
  notRegex?: string;
}

export interface JudgedCommand {
  run: string;
  reference?: string;
  rubric: string[];
}

export interface CaseAssertions {
  judge: string[];
  equals: string[];
  contains: string[];
  notContains: string[];
  regex: string[];
  notRegex: string[];
  skillsUsed: string[];
  skillsForbidden: string[];
  toolsUsed: string[];
  toolsForbidden: string[];
  commandsRun: string[];
  commandsRunForbidden: string[];
  generatedFiles: string[];
  commands: CommandCheck[];
  judgeOnCommand: JudgedCommand[];
}

interface CaseBase {
  category: string;
  name: string;
  level: CaseLevel;
  sourceFile: string;
  environmentKind?: EnvironmentKind;
  repetitions?: number;
  pending: boolean;
  heldOut: boolean;
  timeoutSeconds?: number;
}

export interface InstructionCase extends CaseBase {
  type: "instruction";
  instruction?: string;
  extraInstructions: string[];
  systemPrompt?: string;
  prompt: string;
  model?: string;
  models: Partial<Record<ClientName, string>>;
  effort?: string;
  writes: boolean;
  environment?: EnvironmentDeclaration;
  assertions: CaseAssertions;
}

export interface CliCase extends CaseBase {
  type: "cli";
  command: string;
  stdin?: string;
  exitCode: number;
  environment?: EnvironmentDeclaration;
  assertions: CaseAssertions;
}

export interface McpServerDeclaration {
  name: string;
  command: string[];
  environment: Record<string, string>;
}

export interface McpContractTool {
  name: string;
  required: string[];
}

export interface McpToolCall {
  tool: string;
  arguments: Record<string, unknown>;
  contains: string[];
}

export interface McpCase extends CaseBase {
  type: "mcp";
  server: McpServerDeclaration;
  contract: McpContractTool[];
  strict: boolean;
  calls: McpToolCall[];
}

export type EvalCase = InstructionCase | CliCase | McpCase;

export function caseKey(evalCase: Pick<CaseBase, "category" | "name">): string {
  return `${evalCase.category}/${evalCase.name}`;
}

export function callsModel(evalCase: EvalCase): evalCase is InstructionCase {
  return evalCase.type === "instruction";
}
