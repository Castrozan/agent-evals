import path from "node:path";
import { z } from "zod";
import type { EnvironmentDeclaration, PluginDeclaration, StagingLayer } from "../domain/cases.js";

const optionalText = z.string().min(1).optional();

const stagedRelativePath = z.string().refine(
  (value) => {
    if (path.isAbsolute(value)) return false;
    return !path.normalize(value).split(path.sep).includes("..");
  },
  { message: "o caminho não pode sair da raiz preparada" },
);

const stagedFile = z.object({ path: stagedRelativePath, content: z.string() }).strict();

const gitRepository = z.object({ directory: z.string().min(1), remote: optionalText }).strict();

const repositorySource = z
  .object({
    remote: optionalText,
    revision: z.string().min(1),
    branch: optionalText,
    exclude: z.array(z.string()).default([]),
  })
  .strict();

const stagingLayer = z
  .object({
    from: optionalText,
    at: optionalText,
    git: gitRepository.optional(),
    repository: repositorySource.optional(),
  })
  .strict();

const pluginDeclaration = z
  .object({
    name: optionalText,
    copy: z.array(z.string()).default([]),
    files: z.array(stagedFile).default([]),
    repository: repositorySource.optional(),
    path: optionalText,
  })
  .strict();

export const pluginList = z.preprocess(
  (value) => (value !== null && typeof value === "object" && !Array.isArray(value) ? [value] : value),
  z.array(pluginDeclaration),
);

export const environmentVariables = z.record(z.string(), z.string());

export const environmentSchema = z
  .object({
    git: z.union([z.boolean(), z.array(gitRepository)]).default(false),
    instructions: z.array(z.string()).optional(),
    files: z.array(stagedFile).default([]),
    workspace: optionalText,
    sessionIn: optionalText,
    layers: z.array(stagingLayer).optional(),
    adjustments: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
    removals: z.record(z.string(), z.array(z.string())).default({}),
    plugins: pluginList.default([]),
  })
  .strict()
  .superRefine((declaration, context) => {
    if (declaration.workspace !== undefined && declaration.layers !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["workspace"],
        message: "workspace e camadas não podem ser declarados juntos",
      });
    }
    (declaration.layers ?? []).forEach((layer, index) => {
      if (index > 0 && layer.at === undefined) {
        context.addIssue({
          code: "custom",
          path: ["layers", index, "at"],
          message: "somente a primeira camada pode omitir 'em'",
        });
      }
    });
  })
  .transform((declaration): EnvironmentDeclaration => ({
    git: declaration.git,
    instructions: declaration.instructions,
    files: declaration.files,
    sessionIn: declaration.sessionIn,
    layers:
      declaration.workspace !== undefined
        ? [{ from: declaration.workspace } satisfies StagingLayer]
        : (declaration.layers ?? []),
    adjustments: declaration.adjustments,
    removals: declaration.removals,
    plugins: declaration.plugins as PluginDeclaration[],
  }));
