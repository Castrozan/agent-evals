import { appendFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { SampleResult } from "../../domain/results.js";
import { sha256Hex } from "../../fingerprint/canonical.js";

export interface JournalEntry {
  caseKey: string;
  fingerprint: string;
  profileId: string;
  variant?: string;
  control: boolean;
  sample: SampleResult;
}

export type JournalIdentity = Pick<JournalEntry, "caseKey" | "fingerprint" | "profileId" | "variant" | "control">;

export function journalPathFor(root: string, temporaryDirectory = os.tmpdir()): string {
  return path.join(temporaryDirectory, "agent-evals", sha256Hex(root).slice(0, 16), "journal.jsonl");
}

export function appendJournalEntry(journalPath: string, entry: JournalEntry): void {
  mkdirSync(path.dirname(journalPath), { recursive: true });
  appendFileSync(journalPath, `${JSON.stringify(entry)}\n`);
}

export function discardJournal(journalPath: string): void {
  rmSync(journalPath, { force: true });
}

export function readJournal(journalPath: string): JournalEntry[] {
  let content: string;
  try {
    content = readFileSync(journalPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return content
    .split("\n")
    .filter((line) => line.trim() !== "")
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as JournalEntry];
      } catch {
        return [];
      }
    });
}

export function reusableSamples(entries: readonly JournalEntry[], identity: JournalIdentity): SampleResult[] {
  return entries
    .filter(
      (entry) =>
        entry.caseKey === identity.caseKey &&
        entry.fingerprint === identity.fingerprint &&
        entry.profileId === identity.profileId &&
        entry.variant === identity.variant &&
        entry.control === identity.control &&
        entry.sample.instrumentFailure === undefined,
    )
    .map((entry) => entry.sample);
}
