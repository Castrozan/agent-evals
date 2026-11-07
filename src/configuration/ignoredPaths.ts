import type { ProjectConfig } from "../domain/project.js";

export const ALWAYS_IGNORED_GLOBS = ["evals/resultado/**", "**/node_modules/**", "**/.git/**"];

export function ignoredGlobs(config: Pick<ProjectConfig, "discovery">): string[] {
  return [...ALWAYS_IGNORED_GLOBS, ...config.discovery.ignore];
}
