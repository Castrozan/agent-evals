import type { CaseLevel, EnvironmentKind, PluginDeclaration } from "./cases.js";
import type { ClientName, ClientScopedValue } from "./clients.js";

export interface Thresholds {
  overallFloor: number;
  criticalFloor: number;
  maxDrop: number;
  validityDays: number;
  criticalCategories: string[];
  requiredCategories: string[];
  minimumRepetitions: number;
}

export interface TestSuiteDeclaration {
  command: string;
  junitPath?: string;
  countPattern?: string;
  label?: string;
}

export interface VariantDeclaration {
  plugins: PluginDeclaration[];
  environment: Record<string, string>;
}

export interface CasePatterns {
  any: string[];
  byKind: Partial<Record<EnvironmentKind, string[]>>;
}

export interface ProjectConfig {
  root: string;
  configPath?: string;
  project: string;
  casePatterns: CasePatterns;
  baselinePath: string;
  reportPath: string;
  pagesDirectory: string;
  pagesUrl?: string;
  defaultModel: ClientScopedValue;
  defaultEffort: ClientScopedValue;
  subject: { canonicalClient: ClientName; environment: Record<string, string> };
  judge: { client: ClientName; model?: string; effort?: string; calibrationPath: string };
  discovery: { instructions: string[]; ignore: string[] };
  validateInstructionFormat: boolean;
  repetitionsByLevel: Record<CaseLevel, number>;
  thresholds: Thresholds;
  parallelism: number;
  timeoutSeconds: number;
  testSuite?: TestSuiteDeclaration;
  variants: Record<string, VariantDeclaration>;
  snapshot?: { url: string };
}
