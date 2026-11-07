import path from "node:path";
import type { ClientName } from "../domain/clients.js";
import type { ProjectConfig } from "../domain/project.js";

export interface BaselineLocation {
  client: ClientName;
  profileId: string;
  canonical: boolean;
  variant?: string;
}

export function resolveBaselinePath(config: ProjectConfig, location: BaselineLocation): string {
  const canonicalPath = path.resolve(config.root, config.baselinePath);
  if (location.canonical && location.variant === undefined) return canonicalPath;
  const directory = path.dirname(canonicalPath);
  const name = path.basename(canonicalPath, path.extname(canonicalPath));
  const variantPart = location.variant === undefined ? "" : `-${location.variant}`;
  const profilePart = location.canonical ? "" : `-${location.client}-${location.profileId}`;
  return path.join(directory, `${name}${variantPart}${profilePart}.json`);
}
