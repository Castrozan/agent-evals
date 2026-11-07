import fs from "node:fs";
import path from "node:path";
import { discoverArtifacts } from "../discovery/discoverArtifacts.js";
import type { InstructionFormatFailure } from "../domain/artifacts.js";
import type { ProjectConfig } from "../domain/project.js";
import { checkInstructionContent } from "./instructionRules.js";

export function checkInstructions(config: ProjectConfig): InstructionFormatFailure[] {
  const fileExists = (relativePath: string) => fs.existsSync(path.join(config.root, relativePath));
  return discoverArtifacts(config)
    .filter((artifact) => artifact.kind === "instruction")
    .flatMap((artifact) =>
      checkInstructionContent(
        artifact.path,
        fs.readFileSync(path.join(config.root, artifact.path), "utf8"),
        fileExists,
      ),
    );
}

export function formatInstructionFailure(failure: InstructionFormatFailure): string {
  return `${failure.file}:${failure.line}: ${failure.rule}: ${failure.message}`;
}
