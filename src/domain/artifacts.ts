import type { ClientName } from "./clients.js";

export type ArtifactKind = "instruction" | "cli" | "mcp";

export interface DiscoveredArtifact {
  kind: ArtifactKind;
  path: string;
  name: string;
  interpreter?: string;
  serverCommand?: string[];
}

export interface CoverageEntry {
  artifact: DiscoveredArtifact;
  coveredBy: string[];
}

export interface CalibrationRecord {
  corpusFingerprint: string;
  judge: { client: ClientName; model?: string };
  items: number;
  accuracy: number;
  balancedAccuracy: number;
  recall: number;
  kappa: number;
  passes: number;
  recordedAt: string;
}

export interface TestSuiteCard {
  label?: string;
  ranAt: string;
  commit?: string;
  exitCode: number;
  tests?: number;
  failures?: number;
  errors?: number;
  skipped?: number;
  durationSeconds?: number;
}

export interface InstructionFormatFailure {
  file: string;
  line: number;
  rule: string;
  message: string;
}
