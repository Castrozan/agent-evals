import type { EvalCase, PluginDeclaration } from "./cases.js";
import type { ClientName } from "./clients.js";
import type { ProjectConfig } from "./project.js";
import type { SessionTranscript } from "./results.js";

export type SessionPosture = "none" | "read-only" | "write";

export interface SubjectInvocation {
  client: ClientName;
  model: string;
  effort?: string;
  systemPrompt?: string;
  prompt: string;
  workingDirectory: string;
  posture: SessionPosture;
  stagesGit: boolean;
  pluginDirectories: string[];
  environment: Record<string, string>;
  removedEnvironment: string[];
  timeoutMs: number;
  isolatedContext: boolean;
}

export interface SubjectClient {
  readonly client: ClientName;
  run(invocation: SubjectInvocation): Promise<SessionTranscript>;
  visibleSkills(invocation: SubjectInvocation): Promise<string[]>;
  sdkVersion(): Promise<string | undefined>;
}

export interface StagedSession {
  root: string;
  sessionDirectory: string;
  pluginDirectories: string[];
  environment: Record<string, string>;
  dispose(): Promise<void>;
}

export interface StagingRequest {
  config: ProjectConfig;
  evalCase: EvalCase;
  client: ClientName;
  sourceRoot: string;
  variantPlugins: PluginDeclaration[];
  variantEnvironment: Record<string, string>;
}

export interface SessionStager {
  stage(request: StagingRequest): Promise<StagedSession>;
}
