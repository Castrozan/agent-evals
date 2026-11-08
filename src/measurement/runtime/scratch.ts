import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const SCRATCH_ROOT_VARIABLE = "AGENT_EVALS_SCRATCH";

export function createScratchDirectory(prefix: string): Promise<string> {
  return mkdtemp(path.join(process.env[SCRATCH_ROOT_VARIABLE] ?? os.tmpdir(), prefix));
}
