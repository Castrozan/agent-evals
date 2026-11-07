import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { sha256Hex } from "./canonical.js";

export const MISSING_PATH_HASH = "ausente";

function listTreeFiles(directory: string, relativePrefix = ""): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const relative = relativePrefix === "" ? entry.name : `${relativePrefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...listTreeFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

export function hashFile(filePath: string): string {
  return sha256Hex(readFileSync(filePath));
}

export function hashDirectoryTree(directory: string): string {
  const files = listTreeFiles(directory).sort();
  const digest = files.map((relative) => `${relative}\0${hashFile(path.join(directory, relative))}`).join("\n");
  return sha256Hex(digest);
}

export function hashPath(target: string): string {
  let stats;
  try {
    stats = statSync(target);
  } catch {
    return MISSING_PATH_HASH;
  }
  return stats.isDirectory() ? hashDirectoryTree(target) : hashFile(target);
}
