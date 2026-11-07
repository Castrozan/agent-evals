import type { CaseLevel, CaseType } from "./cases.js";
import type { ExecutionProfile } from "./clients.js";
import type { InstrumentVersions } from "./results.js";

export interface BaselineCaseEntry {
  category: string;
  name: string;
  level: CaseLevel;
  type: CaseType;
  instruction?: string;
  heldOut: boolean;
  fingerprint: string;
  samples: number;
  passes: number;
  sampleOutcomes: boolean[];
  tokenTotals: number[];
  toolOutputCharacters: number[];
  costUsd: number;
  measuredAt: string;
}

export interface Baseline {
  measurementContract: number;
  instrument: InstrumentVersions;
  profile?: ExecutionProfile;
  profileId?: string;
  variant?: string;
  recordedAt: string;
  cases: Record<string, BaselineCaseEntry>;
  instructionFingerprints: Record<string, string>;
  leakedSkills: string[];
}

export interface VerdictReason {
  code: string;
  message: string;
  category?: string;
  caseKey?: string;
  file?: string;
}

export interface RegressionFinding {
  fell: string[];
  fellButFlaky: string[];
  rose: string[];
  pValue: number;
  significant: boolean;
  method: "mcnemar" | "aggregate";
}

export interface Verdict {
  passed: boolean;
  invalid: boolean;
  reasons: VerdictReason[];
  notices: string[];
  regression?: RegressionFinding;
}
