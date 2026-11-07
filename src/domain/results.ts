import type { CaseLevel, CaseType } from "./cases.js";
import type { ExecutionProfile } from "./clients.js";

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
}

export type InstrumentFailureKind = "session-limit" | "credential" | "killed" | "timeout" | "client-error";

export interface InstrumentFailure {
  kind: InstrumentFailureKind;
  message: string;
}

export interface SessionTranscript {
  text: string;
  skillsUsed: string[];
  toolsUsed: string[];
  tokenUsage: TokenUsage;
  toolOutputCharacters: number;
  costUsd?: number;
  durationMs: number;
  instrumentFailure?: InstrumentFailure;
}

export interface AssertionOutcome {
  kind: string;
  passed: boolean;
  message: string;
}

export interface SampleResult {
  caseKey: string;
  repetition: number;
  passed: boolean;
  assertions: AssertionOutcome[];
  output: string;
  instrumentFailure?: InstrumentFailure;
  tokenUsage: TokenUsage;
  toolOutputCharacters: number;
  costUsd?: number;
  durationMs: number;
}

export interface CaseRunResult {
  caseKey: string;
  category: string;
  name: string;
  level: CaseLevel;
  type: CaseType;
  instruction?: string;
  prompt?: string;
  expected?: string[];
  fingerprint: string;
  heldOut: boolean;
  samples: SampleResult[];
  pairedControl?: { withoutInstructionPasses: number; withoutInstructionSamples: number; pValue: number };
}

export interface InstrumentVersions {
  agentEvals: string;
  measurementContract: number;
  promptfoo?: string;
  sdks: Record<string, string>;
}

export interface RunSelection {
  categories: string[];
  cases: string[];
  affected: boolean;
  partition?: "train" | "held-out";
  partial: boolean;
}

export interface RunRecord {
  project: string;
  startedAt: string;
  finishedAt: string;
  profile: ExecutionProfile;
  profileId: string;
  variant?: string;
  revision?: string;
  commit?: string;
  instrument: InstrumentVersions;
  selection: RunSelection;
  overlaidPaths: number;
  leakedSkills: string[];
  instructionFingerprints: Record<string, string>;
  cases: CaseRunResult[];
  invalid?: { reason: string };
}

export function totalTokens(usage: TokenUsage): number {
  return usage.input + usage.output + usage.cacheRead + usage.cacheWrite + usage.reasoning;
}

export function measuredSamples(result: CaseRunResult): SampleResult[] {
  return result.samples.filter((sample) => !sample.instrumentFailure);
}
