import fs from "node:fs/promises";
import path from "node:path";
import type { TestSuiteCard } from "../../../domain/artifacts.js";
import { reportPathsFor } from "../files/reportPaths.js";

const CARD_FILE_NAME = "testes.json";

function cardPathFor(reportPath: string): string {
  return path.join(reportPathsFor(reportPath).directory, CARD_FILE_NAME);
}

export async function saveTestSuiteCard(reportPath: string, card: TestSuiteCard): Promise<string> {
  const cardPath = cardPathFor(reportPath);
  await fs.mkdir(path.dirname(cardPath), { recursive: true });
  const persisted: TestSuiteCard = JSON.parse(
    JSON.stringify({
      label: card.label,
      ranAt: card.ranAt,
      commit: card.commit,
      exitCode: card.exitCode,
      tests: card.tests,
      failures: card.failures,
      errors: card.errors,
      skipped: card.skipped,
      durationSeconds: card.durationSeconds,
    }),
  );
  await fs.writeFile(cardPath, `${JSON.stringify(persisted, null, 2)}\n`);
  return cardPath;
}

export async function loadTestSuiteCard(reportPath: string): Promise<TestSuiteCard | undefined> {
  const text = await fs.readFile(cardPathFor(reportPath), "utf8").catch(() => undefined);
  if (text === undefined) return undefined;
  const parsed = JSON.parse(text) as Partial<TestSuiteCard>;
  if (typeof parsed.ranAt !== "string" || typeof parsed.exitCode !== "number") return undefined;
  return parsed as TestSuiteCard;
}
