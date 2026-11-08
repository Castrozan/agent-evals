import type { ArtifactKind, CalibrationRecord, TestSuiteCard } from "../../../domain/artifacts.js";
import type { CaseLevel, CaseType } from "../../../domain/cases.js";
import type { ExecutionProfile } from "../../../domain/clients.js";
import type { InstrumentVersions } from "../../../domain/results.js";
import type { RegressionFinding, VerdictReason } from "../../../domain/baseline.js";

export const REPORT_SCHEMA_VERSION = 1;

export type VerdictStatus = "approved" | "failed" | "invalid";

export type CaseStatus = "passed" | "failed" | "unmeasured";

export interface ReportCase {
  key: string;
  category: string;
  name: string;
  level: CaseLevel;
  type: CaseType;
  instruction?: string;
  heldOut: boolean;
  inherited: boolean;
  measuredAt: string;
  samples: number;
  passes: number;
  rate: number | null;
  outcomes: boolean[];
  flaky: boolean;
  status: CaseStatus;
  costUsd: number;
  durationSeconds: number;
  pairedControl?: { withoutInstructionPasses: number; withoutInstructionSamples: number; pValue: number };
}

export interface ReportGroup {
  path: string | null;
  name: string;
  kind: ArtifactKind | null;
  samples: number;
  passes: number;
  rate: number | null;
  cases: ReportCase[];
}

export interface ReportCategory {
  name: string;
  samples: number;
  passes: number;
  rate: number | null;
  groups: ReportGroup[];
}

export interface ReportFailure {
  key: string;
  category: string;
  name: string;
  level: CaseLevel;
  heldOut: boolean;
  inherited: boolean;
  passes: number;
  samples: number;
  input?: string;
  expected: string[];
  actualOutput?: string;
  failedAssertions: string[];
  failingSince?: string;
}

export interface ReportFlaky {
  key: string;
  heldOut: boolean;
  inherited: boolean;
  passes: number;
  samples: number;
}

export interface ReportUncovered {
  kind: ArtifactKind;
  path: string;
  name: string;
  onlyPending: boolean;
}

export interface LevelTotals {
  level: CaseLevel;
  cases: number;
  samples: number;
  costUsd: number;
  durationSeconds: number;
}

export interface KindCoverage {
  kind: ArtifactKind;
  total: number;
  covered: number;
}

export interface ReportRate {
  value: number;
  lower: number;
  upper: number;
  passes: number;
  samples: number;
}

export interface ReportNoise {
  floor: number;
  headroom: number;
  headroomExceedsNoise: boolean;
}

export interface ReportMeasured {
  partial: boolean;
  measuredCases: number;
  inheritedCases: number;
  totalCases: number;
  categories: string[];
  caseFilters: string[];
  affected: boolean;
  partition?: "train" | "held-out";
}

export type ReportCalibration =
  { status: "never" } | { status: "current" | "stale"; kappa: number; accuracy: number; recordedAt: string };

export interface ReportHeader {
  project: string;
  generatedAt: string;
  commit?: string;
  revision?: string;
  variant?: string;
  profile: ExecutionProfile;
  status: VerdictStatus;
  invalidReason?: string;
  rate: ReportRate | null;
  previousRate: number | null;
  passAtK: { k: number; value: number; cases: number }[];
  noise: ReportNoise | null;
  measured: ReportMeasured;
  levels: LevelTotals[];
  coverage: KindCoverage[];
  pendingCases: number;
  instrument: InstrumentVersions;
  calibration: ReportCalibration;
  isolation: { isolated: boolean; leakedSkills: string[] };
  reasons: VerdictReason[];
  notices: string[];
  regression?: RegressionFinding;
  testSuite?: TestSuiteCard;
}

export interface ReportDocument {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  header: ReportHeader;
  categories: ReportCategory[];
  failures: ReportFailure[];
  flaky: ReportFlaky[];
  uncovered: ReportUncovered[];
}

export type CalibrationInput = CalibrationRecord & { stale: boolean };
