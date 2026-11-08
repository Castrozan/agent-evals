import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument, type Document } from "yaml";
import type { StagedFile } from "../../../domain/cases.js";
import { resolveInside } from "../pathSafety.js";
import { StagingError } from "../stagingError.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeJson(target: Record<string, unknown>, changes: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(changes)) {
    const existing = target[key];
    if (isPlainObject(value) && isPlainObject(existing)) mergeJson(existing, value);
    else target[key] = value;
  }
}

function mergeYaml(document: Document, pathSegments: string[], changes: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(changes)) {
    const keyPath = [...pathSegments, key];
    if (isPlainObject(value) && isMap(document.getIn(keyPath, true))) mergeYaml(document, keyPath, value);
    else document.setIn(keyPath, value);
  }
}

async function editStructuredFile(
  root: string,
  relativePath: string,
  editJson: (data: Record<string, unknown>) => void,
  editYaml: (document: Document) => void,
): Promise<void> {
  const target = resolveInside(root, relativePath, "caminho do arquivo");
  const original = await readFile(target, "utf8").catch(() => undefined);
  if (original === undefined) {
    throw new StagingError(`O arquivo "${relativePath}" não foi trazido por nenhuma camada e não pode ser ajustado.`);
  }
  if (path.extname(target) === ".json") {
    const data = JSON.parse(original) as Record<string, unknown>;
    editJson(data);
    await writeFile(target, `${JSON.stringify(data, null, 2)}\n`);
    return;
  }
  const document = parseDocument(original);
  editYaml(document);
  await writeFile(target, document.toString());
}

export async function writeStagedFiles(root: string, files: StagedFile[]): Promise<void> {
  for (const file of files) {
    const target = resolveInside(root, file.path, "caminho do arquivo");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
}

export async function applyAdjustments(root: string, adjustments: Record<string, Record<string, unknown>>) {
  for (const [relativePath, changes] of Object.entries(adjustments)) {
    await editStructuredFile(
      root,
      relativePath,
      (data) => mergeJson(data, changes),
      (document) => mergeYaml(document, [], changes),
    );
  }
}

export async function applyRemovals(root: string, removals: Record<string, string[]>): Promise<void> {
  for (const [relativePath, keys] of Object.entries(removals)) {
    await editStructuredFile(
      root,
      relativePath,
      (data) => keys.forEach((key) => delete data[key]),
      (document) => keys.forEach((key) => document.delete(key)),
    );
  }
}
