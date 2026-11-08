import path from "node:path";
import { StagingError } from "./stagingError.js";

export function resolveInside(root: string, relativePath: string, description = "caminho"): string {
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (path.isAbsolute(relativePath) || relative === ".." || relative.startsWith(`..${path.sep}`)) {
    throw new StagingError(`O ${description} "${relativePath}" escapa da raiz da sessão.`);
  }
  return resolved;
}

export function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
