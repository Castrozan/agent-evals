import { readFileSync } from "node:fs";
import { MEASUREMENT_CONTRACT } from "../../../domain/measurement.js";
import type { InstrumentVersions } from "../../../domain/results.js";

export function readPackageVersion(): string {
  const packagePath = new URL("../../../../package.json", import.meta.url);
  return (JSON.parse(readFileSync(packagePath, "utf8")) as { version: string }).version;
}

export function buildInstrumentVersions(
  promptfooVersion: string | undefined,
  sdks: Record<string, string>,
): InstrumentVersions {
  return {
    agentEvals: readPackageVersion(),
    measurementContract: MEASUREMENT_CONTRACT,
    promptfoo: promptfooVersion,
    sdks,
  };
}
