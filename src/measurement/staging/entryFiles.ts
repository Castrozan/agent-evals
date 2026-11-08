import { cp, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { resolveInside } from "./pathSafety.js";
import { StagingError } from "./stagingError.js";

export async function copyEntryFiles(
  root: string,
  sourceRoot: string,
  entryFiles: string[],
  required: boolean,
): Promise<void> {
  for (const entryFile of entryFiles) {
    const origin = resolveInside(sourceRoot, entryFile, "arquivo de instrução");
    if (!(await stat(origin).catch(() => undefined))) {
      if (required) throw new StagingError(`O arquivo de instrução "${entryFile}" não existe no repositório avaliado.`);
      continue;
    }
    const target = resolveInside(root, entryFile, "arquivo de instrução");
    await mkdir(path.dirname(target), { recursive: true });
    await cp(origin, target, { force: true });
  }
}
