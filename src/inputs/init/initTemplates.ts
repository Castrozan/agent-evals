import path from "node:path";
import { stringify } from "yaml";
import type { DiscoveredArtifact } from "../../domain/artifacts.js";
import type { McpServerDeclaration } from "../../domain/cases.js";
import type { McpTool } from "../../measurement/mcp/stdioClient.js";

export const CASES_DIRECTORY = "evals/casos";
export const WORKFLOW_PATH = ".github/workflows/evals.yml";

export function slugify(value: string): string {
  return value
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function configTemplate(projectName: string): string {
  return stringify({
    projeto: projectName,
    casos: [`${CASES_DIRECTORY}/**/*.yaml`],
    modelo_padrao: { claude: "haiku" },
    juiz: { modelo: "opus" },
    execucoes: { unidade: 3, integracao: 3, "ponta-a-ponta": 1 },
  });
}

export function instructionCaseFile(artifact: DiscoveredArtifact): {
  path: string;
  content: string;
} {
  const slug = slugify(artifact.path);
  return {
    path: path.posix.join(CASES_DIRECTORY, "instrucoes", `${slug}.yaml`),
    content: stringify({
      categoria: "instrucoes",
      casos: [{ nome: slug, instrucao: artifact.path, pendente: true }],
    }),
  };
}

function smokeCommand(artifact: DiscoveredArtifact): string {
  if (artifact.interpreter) return `${artifact.interpreter} ${artifact.path} --help`;
  if (artifact.path.endsWith("pyproject.toml")) return `${artifact.name} --help`;
  return `./${artifact.path} --help`;
}

export function commandLineCaseFile(artifact: DiscoveredArtifact): {
  path: string;
  content: string;
} {
  const slug = slugify(`${artifact.path}-${artifact.name}`);
  return {
    path: path.posix.join(CASES_DIRECTORY, "cli", `${slug}.yaml`),
    content: stringify({
      categoria: "cli",
      casos: [
        {
          nome: `${slug} ajuda`,
          tipo: "cli",
          comando: smokeCommand(artifact),
          codigo_de_saida: 0,
        },
      ],
    }),
  };
}

export function mcpCaseFile(server: McpServerDeclaration, tools: McpTool[]): { path: string; content: string } {
  return {
    path: path.posix.join(CASES_DIRECTORY, "mcp", `${slugify(server.name)}.yaml`),
    content: stringify({
      categoria: "mcp",
      casos: [
        {
          nome: `${server.name} contrato`,
          tipo: "mcp",
          servidor: {
            nome: server.name,
            comando: server.command,
            ...(Object.keys(server.environment).length > 0 ? { ambiente: server.environment } : {}),
          },
          contrato: tools.map((tool) => ({
            nome: tool.name,
            obrigatorios: tool.inputSchema?.required ?? [],
          })),
        },
      ],
    }),
  };
}

export const workflowTemplate = `name: evals

on:
  push:
    branches: [main]
  pull_request:

jobs:
  check:
    uses: Castrozan/agent-evals/.github/workflows/check.yml@main
    secrets: inherit

  pages:
    needs: check
    if: github.ref == 'refs/heads/main'
    permissions:
      contents: read
      pages: write
      id-token: write
    uses: Castrozan/agent-evals/.github/workflows/pages.yml@main
    secrets: inherit
`;
