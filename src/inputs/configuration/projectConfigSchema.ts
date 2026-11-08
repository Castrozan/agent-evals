import { z } from "zod";
import { CLIENT_NAMES, type ClientScopedValue } from "../../domain/clients.js";
import type { CasePatterns, ProjectConfig } from "../../domain/project.js";
import { environmentVariables, pluginList } from "./environmentSchema.js";

const clientName = z.enum(CLIENT_NAMES);
const nonEmptyText = z.string().min(1);
const positiveInteger = z.number().int().positive();
const fraction = z.number().min(0).max(1);

const clientScopedValue = z
  .union([nonEmptyText, z.partialRecord(clientName, nonEmptyText)])
  .transform((value): ClientScopedValue =>
    typeof value === "string" ? { scalar: value, byClient: {} } : { byClient: value },
  );

const casePatternList = z.union([nonEmptyText.transform((pattern) => [pattern]), z.array(nonEmptyText)]);

const casePatterns = z.union([
  z.array(nonEmptyText).transform((any) => ({ any, byKind: {} })),
  z
    .object({ skill: casePatternList.optional(), package: casePatternList.optional() })
    .strict()
    .transform((byKind) => ({
      any: [],
      byKind: Object.fromEntries(
        Object.entries(byKind).filter(([, value]) => value !== undefined),
      ) as CasePatterns["byKind"],
    })),
]);

const countPattern = z.string().superRefine((pattern, context) => {
  try {
    new RegExp(pattern);
  } catch {
    context.addIssue({ code: "custom", message: "expressão regular inválida" });
    return;
  }
  const groups = ["passou", "passed"].some((name) => pattern.includes(`(?<${name}>`));
  if (!groups) {
    context.addIssue({
      code: "custom",
      message: "a expressão precisa do grupo nomeado 'passou' ou 'passed'",
    });
  }
});

const testSuite = z
  .object({
    command: nonEmptyText,
    junit: nonEmptyText.optional(),
    count: countPattern.optional(),
    label: nonEmptyText.optional(),
  })
  .strict()
  .transform((suite) => ({
    command: suite.command,
    junitPath: suite.junit,
    countPattern: suite.count,
    label: suite.label,
  }));

const variant = z.object({ plugins: pluginList.default([]), environment: environmentVariables.default({}) }).strict();

const kebabCaseName = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const projectConfigSchema = z
  .object({
    project: nonEmptyText.optional(),
    casePatterns: casePatterns.optional(),
    baseline: nonEmptyText.default("evals/baseline.json"),
    report: nonEmptyText.default("evals/resultado/relatorio.html"),
    pages: nonEmptyText.default("public"),
    pagesUrl: z.url({ protocol: /^https$/ }).optional(),
    defaultModel: clientScopedValue.default({ byClient: {} }),
    defaultEffort: clientScopedValue.default({ byClient: {} }),
    subject: z
      .object({
        client: clientName.default("claude"),
        environment: environmentVariables.default({}),
        removedEnvironment: z.array(nonEmptyText).default([]),
      })
      .strict()
      .default({ client: "claude", environment: {}, removedEnvironment: [] }),
    judge: z
      .object({
        model: nonEmptyText.optional(),
        client: clientName.default("claude"),
        effort: nonEmptyText.optional(),
        calibration: nonEmptyText.default("evals/calibracao.yaml"),
      })
      .strict()
      .default({ client: "claude", calibration: "evals/calibracao.yaml" }),
    discovery: z
      .object({
        instructions: z.array(nonEmptyText).default(["CLAUDE.md", "AGENTS.md"]),
        ignore: z.array(z.string()).default([]),
      })
      .strict()
      .default({ instructions: ["CLAUDE.md", "AGENTS.md"], ignore: [] }),
    validateInstructionFormat: z.boolean().default(true),
    repetitions: z
      .object({
        unit: positiveInteger.default(1),
        integration: positiveInteger.default(1),
        "end-to-end": positiveInteger.default(1),
      })
      .strict()
      .default({ unit: 1, integration: 1, "end-to-end": 1 }),
    thresholds: z
      .object({
        overallFloor: fraction.default(0.75),
        criticalFloor: fraction.default(0.85),
        maxDrop: fraction.default(0.05),
        validityDays: positiveInteger.default(30),
        criticalCategories: z.array(nonEmptyText).default([]),
        requiredCategories: z.array(nonEmptyText).default([]),
        minimumRepetitions: positiveInteger.default(2),
      })
      .strict()
      .default({
        overallFloor: 0.75,
        criticalFloor: 0.85,
        maxDrop: 0.05,
        validityDays: 30,
        criticalCategories: [],
        requiredCategories: [],
        minimumRepetitions: 2,
      }),
    parallelism: positiveInteger.default(4),
    timeoutSeconds: positiveInteger.default(180),
    testSuite: testSuite.optional(),
    variants: z
      .record(z.string(), variant)
      .default({})
      .superRefine((variants, context) => {
        for (const name of Object.keys(variants)) {
          if (!kebabCaseName.test(name)) {
            context.addIssue({
              code: "custom",
              path: [name],
              message: "o nome da variante deve estar em kebab-case",
            });
          }
        }
      }),
    snapshot: z.object({ url: z.url() }).strict().optional(),
  })
  .strict();

export type ParsedProjectConfig = z.output<typeof projectConfigSchema>;

export function toProjectConfig(
  parsed: ParsedProjectConfig,
  root: string,
  configPath: string | undefined,
  fallbackProjectName: string,
): ProjectConfig {
  return {
    root,
    configPath,
    project: parsed.project ?? fallbackProjectName,
    casePatterns: parsed.casePatterns ?? { any: ["evals/**/*.{yaml,yml}"], byKind: {} },
    baselinePath: parsed.baseline,
    reportPath: parsed.report,
    pagesDirectory: parsed.pages,
    pagesUrl: parsed.pagesUrl,
    defaultModel: parsed.defaultModel,
    defaultEffort: parsed.defaultEffort,
    subject: {
      canonicalClient: parsed.subject.client,
      environment: parsed.subject.environment,
      removedEnvironment: parsed.subject.removedEnvironment,
    },
    judge: {
      client: parsed.judge.client,
      model: parsed.judge.model,
      effort: parsed.judge.effort,
      calibrationPath: parsed.judge.calibration,
    },
    discovery: parsed.discovery,
    validateInstructionFormat: parsed.validateInstructionFormat,
    repetitionsByLevel: parsed.repetitions,
    thresholds: parsed.thresholds,
    parallelism: parsed.parallelism,
    timeoutSeconds: parsed.timeoutSeconds,
    testSuite: parsed.testSuite,
    variants: parsed.variants,
    snapshot: parsed.snapshot,
  };
}
