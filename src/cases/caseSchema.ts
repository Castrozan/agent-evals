import { z } from "zod";
import { CLIENT_NAMES } from "../domain/clients.js";
import type { CaseAssertions, EvalCase } from "../domain/cases.js";
import { environmentSchema, environmentVariables } from "../configuration/environmentSchema.js";

const text = z.string();
const textList = z.array(text).default([]);

const commonShape = {
  name: z.string().min(1),
  level: z.enum(["unit", "integration", "end-to-end"]).default("unit"),
  repetitions: z.number().int().positive().optional(),
  pending: z.boolean().default(false),
  heldOut: z.boolean().default(false),
  timeoutSeconds: z.number().positive().optional(),
};

const commandCheck = z.object({ run: text.min(1), regex: text.optional(), notRegex: text.optional() }).strict();

const judgedCommand = z.object({ run: text.min(1), reference: text.optional(), rubric: z.array(text).min(1) }).strict();

const textAssertionShape = {
  judge: textList,
  contains: textList,
  notContains: textList,
  regex: textList,
  notRegex: textList,
  generatedFiles: textList,
};

const textOrList = z.union([text.transform((value) => [value]), z.array(text)]).default([]);

const instructionAssertions = z
  .object({
    ...textAssertionShape,
    equals: textOrList,
    skillsUsed: textList,
    skillsForbidden: textList,
    toolsUsed: textList,
    toolsForbidden: textList,
    commandsRun: textList,
    commandsRunForbidden: textList,
    commands: z.array(commandCheck).default([]),
    judgeOnCommand: z.array(judgedCommand).default([]),
  })
  .strict();

const commandAssertions = z
  .object({
    contains: textList,
    notContains: textList,
    regex: textList,
    notRegex: textList,
    generatedFiles: textList,
  })
  .strict();

const emptyAssertions: CaseAssertions = {
  judge: [],
  equals: [],
  contains: [],
  notContains: [],
  regex: [],
  notRegex: [],
  skillsUsed: [],
  skillsForbidden: [],
  toolsUsed: [],
  toolsForbidden: [],
  commandsRun: [],
  commandsRunForbidden: [],
  generatedFiles: [],
  commands: [],
  judgeOnCommand: [],
};

const instructionCase = z
  .object({
    ...commonShape,
    type: z.literal("instruction"),
    environment: environmentSchema.optional(),
    instruction: text.min(1).optional(),
    extraInstructions: textList,
    systemPrompt: text.optional(),
    prompt: text.optional(),
    model: text.min(1).optional(),
    models: z.partialRecord(z.enum(CLIENT_NAMES), text.min(1)).default({}),
    effort: text.min(1).optional(),
    writes: z.boolean().default(false),
    assertions: instructionAssertions.default(() => instructionAssertions.parse({})),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.prompt === undefined && !value.pending) {
      context.addIssue({ code: "custom", path: ["prompt"], message: "campo obrigatório" });
    }
  });

const cliCase = z
  .object({
    ...commonShape,
    type: z.literal("cli"),
    environment: environmentSchema.optional(),
    command: text.min(1),
    stdin: text.optional(),
    exitCode: z.number().int().default(0),
    assertions: commandAssertions.default(() => commandAssertions.parse({})),
  })
  .strict();

const mcpCase = z
  .object({
    ...commonShape,
    type: z.literal("mcp"),
    server: z
      .object({
        name: text.min(1),
        command: z.array(text.min(1)).min(1),
        environment: environmentVariables.default({}),
      })
      .strict(),
    contract: z.array(z.object({ name: text.min(1), required: textList }).strict()).default([]),
    strict: z.boolean().default(false),
    calls: z
      .array(
        z
          .object({
            tool: text.min(1),
            arguments: z.record(text, z.unknown()).default({}),
            contains: textList,
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const caseSchema = z.discriminatedUnion("type", [instructionCase, cliCase, mcpCase]);

export type ParsedCase = z.output<typeof caseSchema>;

export function toEvalCase(parsed: ParsedCase, category: string, sourceFile: string): EvalCase {
  const base = { category, sourceFile, ...parsed };
  if (parsed.type === "cli") {
    return { ...base, assertions: { ...emptyAssertions, ...parsed.assertions } } as EvalCase;
  }
  if (parsed.type === "instruction") {
    return { ...base, prompt: parsed.prompt ?? "" } as EvalCase;
  }
  return base as EvalCase;
}
