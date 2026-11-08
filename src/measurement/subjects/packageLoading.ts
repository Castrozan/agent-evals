import { SubjectConfigurationError } from "./configurationError.js";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class MissingSubjectPackageError extends SubjectConfigurationError {
  constructor(packageName: string) {
    super(
      `O pacote ${packageName} não está instalado, mas o cliente escolhido depende dele. Instale com: npm install ${packageName}`,
    );
    this.name = "MissingSubjectPackageError";
  }
}

const MISSING_MODULE_PATTERN = /Cannot find (package|module)|Failed to resolve (import|entry)|ERR_MODULE_NOT_FOUND/i;

export async function loadSubjectPackage<Module>(
  packageName: string,
  importer: () => Promise<Module>,
): Promise<Module> {
  try {
    return await importer();
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    const message = error instanceof Error ? error.message : String(error);
    if (code === "ERR_MODULE_NOT_FOUND" || MISSING_MODULE_PATTERN.test(message)) {
      throw new MissingSubjectPackageError(packageName);
    }
    throw error;
  }
}

export function readInstalledVersion(
  packageName: string,
  startDirectory = path.dirname(fileURLToPath(import.meta.url)),
): string | undefined {
  let directory = startDirectory;
  for (;;) {
    const manifestPath = path.join(directory, "node_modules", packageName, "package.json");
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { version?: string };
      return manifest.version;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}
