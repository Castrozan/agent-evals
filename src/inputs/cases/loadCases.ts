import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { ConfigurationError, normalizeValue } from "../configuration/aliasNormalization.js";
import { toConfigurationError } from "../configuration/zodIssues.js";
import { caseKey, type EvalCase } from "../../domain/cases.js";
import type { ProjectConfig } from "../../domain/project.js";
import { caseFileShape } from "./caseKeys.js";
import { findCaseFiles, type CaseFileCandidate } from "./caseFiles.js";
import { findKindRuleViolation } from "./caseRules.js";
import { caseSchema, toEvalCase } from "./caseSchema.js";

function isCaseFileDocument(document: unknown): document is Record<string, unknown> {
  if (typeof document !== "object" || document === null || Array.isArray(document)) return false;
  return "casos" in document || "cases" in document;
}

function parseCaseFile(config: ProjectConfig, candidate: CaseFileCandidate): EvalCase[] {
  const { relativePath, environmentKind } = candidate;
  let document: unknown;
  try {
    document = parse(fs.readFileSync(path.join(config.root, relativePath), "utf8"));
  } catch (error) {
    throw new ConfigurationError(`${relativePath}: YAML inválido: ${(error as Error).message}`);
  }
  if (!isCaseFileDocument(document)) return [];
  const normalized = normalizeValue(document, caseFileShape, [], relativePath) as Record<string, unknown>;
  if (typeof normalized.category !== "string" || normalized.category === "") {
    throw new ConfigurationError(`${relativePath}: "categoria" é obrigatória`);
  }
  const rawCases = normalized.cases;
  if (!Array.isArray(rawCases)) {
    throw new ConfigurationError(`${relativePath}: "casos" deve ser uma lista`);
  }
  const category = normalized.category;
  const failures: string[] = [];
  const cases: EvalCase[] = [];
  rawCases.forEach((rawCase: unknown, index) => {
    const withType = typeof rawCase === "object" && rawCase !== null ? { type: "instruction", ...rawCase } : rawCase;
    const result = caseSchema.safeParse(withType);
    if (!result.success) {
      failures.push(toConfigurationError(result.error, caseFileShape, relativePath, ["cases", index]).message);
      return;
    }
    const evalCase = toEvalCase(result.data, category, relativePath);
    if (environmentKind) evalCase.environmentKind = environmentKind;
    const violation = findKindRuleViolation(evalCase);
    if (violation) failures.push(`${relativePath}: ${caseKey(evalCase)}: ${violation}`);
    cases.push(evalCase);
  });
  if (failures.length > 0) throw new ConfigurationError(failures.join("\n"));
  return cases;
}

function findDuplicates(cases: EvalCase[]): string[] {
  const firstFileByKey = new Map<string, string>();
  const failures: string[] = [];
  for (const evalCase of cases) {
    const key = caseKey(evalCase);
    const firstFile = firstFileByKey.get(key);
    if (firstFile === undefined) {
      firstFileByKey.set(key, evalCase.sourceFile);
    } else {
      failures.push(`caso duplicado "${key}" em ${firstFile} e ${evalCase.sourceFile}`);
    }
  }
  return failures;
}

export function loadCases(config: ProjectConfig): EvalCase[] {
  const failures: string[] = [];
  const cases: EvalCase[] = [];
  for (const candidate of findCaseFiles(config)) {
    try {
      cases.push(...parseCaseFile(config, candidate));
    } catch (error) {
      if (!(error instanceof ConfigurationError)) throw error;
      failures.push(error.message);
    }
  }
  failures.push(...findDuplicates(cases));
  if (failures.length > 0) throw new ConfigurationError(failures.join("\n"));
  return cases;
}
