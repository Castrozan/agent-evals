import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectConfig } from "../../../domain/project.js";
import { reportPathsFor } from "../files/reportPaths.js";

export async function buildPagesDirectory(
  config: Pick<ProjectConfig, "root" | "reportPath" | "pagesDirectory">,
): Promise<string> {
  const source = reportPathsFor(path.resolve(config.root, config.reportPath));
  const directory = path.resolve(config.root, config.pagesDirectory);
  const copies = [
    [source.htmlPath, "index.html"],
    [source.jsonPath, "report.json"],
    [source.badgePath, "badge.svg"],
  ] as const;
  for (const [sourcePath] of copies) {
    try {
      await fs.access(sourcePath);
    } catch {
      throw new Error(
        `Nenhum relatório encontrado em ${source.directory} (falta ${path.basename(sourcePath)}); rode \`agent-evals run\` antes de publicar as páginas.`,
      );
    }
  }
  await fs.mkdir(directory, { recursive: true });
  for (const [sourcePath, targetName] of copies) await fs.copyFile(sourcePath, path.join(directory, targetName));
  return directory;
}
