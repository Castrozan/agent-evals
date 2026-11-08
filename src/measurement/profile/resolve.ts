import type { InstructionCase } from "../../domain/cases.js";
import type { ClientName } from "../../domain/clients.js";
import type { ProjectConfig } from "../../domain/project.js";
import { validateEffort, validateModel } from "./validation.js";

export interface ResolutionOverrides {
  evalCase?: Pick<InstructionCase, "model" | "models" | "effort">;
  cliModel?: string;
  cliEffort?: string;
}

function isCanonical(config: ProjectConfig, client: ClientName): boolean {
  return config.subject.canonicalClient === client;
}

export function resolveSubjectModel(
  config: ProjectConfig,
  client: ClientName,
  overrides: ResolutionOverrides = {},
): string {
  const canonical = isCanonical(config, client);
  const resolved =
    overrides.cliModel ??
    overrides.evalCase?.models[client] ??
    (canonical ? overrides.evalCase?.model : undefined) ??
    config.defaultModel.byClient[client] ??
    (canonical ? config.defaultModel.scalar : undefined);
  if (resolved === undefined) {
    const scalarNote = canonical
      ? ""
      : ` (o valor escalar de modelo_padrao só vale para o cliente canônico ${config.subject.canonicalClient})`;
    throw new Error(
      `Modelo não definido para o cliente ${client}: declare modelo_padrao.${client} e modelo_padrao em evals/config.yaml${scalarNote}.`,
    );
  }
  return validateModel(client, resolved);
}

export function resolveSubjectEffort(
  config: ProjectConfig,
  client: ClientName,
  overrides: ResolutionOverrides = {},
): string | undefined {
  const canonical = isCanonical(config, client);
  const resolved =
    overrides.cliEffort ??
    (canonical ? overrides.evalCase?.effort : undefined) ??
    config.defaultEffort.byClient[client] ??
    (canonical ? config.defaultEffort.scalar : undefined);
  return resolved === undefined ? undefined : validateEffort(client, resolved);
}
