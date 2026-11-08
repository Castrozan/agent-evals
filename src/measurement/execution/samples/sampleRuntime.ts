import type { PluginDeclaration } from "../../../domain/cases.js";
import type { ClientName, ExecutionProfile } from "../../../domain/clients.js";
import type { SessionStager, SubjectClient } from "../../../domain/ports.js";
import type { ProjectConfig } from "../../../domain/project.js";
import type { InstrumentFailure, SampleResult, TokenUsage } from "../../../domain/results.js";

export type SubjectClientFactory = (client: ClientName) => SubjectClient;

export interface SampleSettings {
  config: ProjectConfig;
  profile: ExecutionProfile;
  sourceRoot: string;
  variantPlugins: PluginDeclaration[];
  variantEnvironment: Record<string, string>;
}

export interface SampleRuntime extends SampleSettings {
  clients: SubjectClientFactory;
  stager: SessionStager;
}

export const SOURCE_ROOT_VARIABLE = "AGENT_EVALS_SOURCE_ROOT";

export const EMPTY_TOKEN_USAGE: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };

export function instrumentFailureSample(
  caseKey: string,
  repetition: number,
  instrumentFailure: InstrumentFailure,
  durationMs: number,
): SampleResult {
  return {
    caseKey,
    repetition,
    passed: false,
    assertions: [],
    output: "",
    instrumentFailure,
    tokenUsage: EMPTY_TOKEN_USAGE,
    toolOutputCharacters: 0,
    durationMs,
  };
}

export function substituteSession(value: string, sessionDirectory: string): string {
  return value.replaceAll("{sessao}", sessionDirectory);
}

export function substituteSessionInAll(
  values: Record<string, string>,
  sessionDirectory: string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, substituteSession(value, sessionDirectory)]),
  );
}
