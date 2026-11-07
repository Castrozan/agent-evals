import fs from "node:fs";
import path from "node:path";
import { globSync } from "tinyglobby";
import type { DiscoveredArtifact } from "../domain/artifacts.js";

const INTERPRETER_BY_EXTENSION: Record<string, string> = {
  ".py": "python3",
  ".sh": "bash",
  ".bash": "bash",
  ".js": "node",
  ".mjs": "node",
  ".cjs": "node",
  ".rb": "ruby",
  ".pl": "perl",
};

export function interpreterForPath(filePath: string): string | undefined {
  return INTERPRETER_BY_EXTENSION[path.posix.extname(filePath)];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relativeTo(root: string, directory: string, target: string): string {
  return path.posix.normalize(path.posix.join(directory, target)).replace(/^\.\//, "");
}

function binEntries(packageName: string, bin: unknown): { name: string; target: string }[] {
  if (typeof bin === "string") {
    return [{ name: packageName.replace(/^@[^/]+\//, ""), target: bin }];
  }
  if (typeof bin !== "object" || bin === null) return [];
  return Object.entries(bin)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([name, target]) => ({ name, target }));
}

function packageJsonScripts(root: string, ignore: string[]): DiscoveredArtifact[] {
  return globSync("**/package.json", { cwd: root, ignore }).flatMap((manifestPath) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, manifestPath), "utf8")) as {
      name?: string;
      bin?: unknown;
    };
    const directory = path.posix.dirname(manifestPath);
    return binEntries(manifest.name ?? path.posix.basename(directory), manifest.bin).map(({ name, target }) => ({
      kind: "cli" as const,
      path: relativeTo(root, directory, target),
      name,
    }));
  });
}

export function parsePyprojectScripts(content: string): string[] {
  const names: string[] = [];
  let insideScripts = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, "").trim();
    if (line.startsWith("[")) {
      insideScripts = line === "[project.scripts]";
      continue;
    }
    const match = insideScripts ? /^["']?([\w.-]+)["']?\s*=/.exec(line) : null;
    if (match?.[1]) names.push(match[1]);
  }
  return names;
}

function pyprojectScripts(root: string, ignore: string[]): DiscoveredArtifact[] {
  return globSync("**/pyproject.toml", { cwd: root, ignore }).flatMap((manifestPath) =>
    parsePyprojectScripts(fs.readFileSync(path.join(root, manifestPath), "utf8")).map((name) => ({
      kind: "cli" as const,
      path: manifestPath,
      name,
    })),
  );
}

function looseScripts(root: string, ignore: string[]): DiscoveredArtifact[] {
  return globSync("**/{scripts,bin,tools}/*", { cwd: root, ignore }).flatMap((relativePath) => {
    const extension = path.posix.extname(relativePath);
    const interpreter = interpreterForPath(relativePath);
    const executable = (fs.statSync(path.join(root, relativePath)).mode & 0o111) !== 0;
    if (interpreter === undefined && !executable) return [];
    return [
      {
        kind: "cli" as const,
        path: relativePath,
        name: path.posix.basename(relativePath, extension),
        ...(interpreter ? { interpreter } : {}),
      },
    ];
  });
}

export function discoverCommandLineTools(root: string, ignore: string[]): DiscoveredArtifact[] {
  const declared = [...packageJsonScripts(root, ignore), ...pyprojectScripts(root, ignore)];
  const declaredPaths = new Set(declared.map((artifact) => artifact.path));
  const loose = looseScripts(root, ignore).filter((artifact) => !declaredPaths.has(artifact.path));
  return [...declared, ...loose].sort(
    (left, right) => compareText(left.path, right.path) || compareText(left.name, right.name),
  );
}
