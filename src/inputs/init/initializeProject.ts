import fs from "node:fs";
import path from "node:path";
import { loadCases } from "../cases/loadCases.js";
import { loadProjectConfig } from "../configuration/loadProjectConfig.js";
import { CONFIG_RELATIVE_PATH } from "../configuration/repositoryRoot.js";
import { computeCoverage } from "../discovery/coverage.js";
import { discoverArtifacts } from "../discovery/discoverArtifacts.js";
import { readMcpServers } from "../discovery/mcpServers.js";
import { connectMcpServer } from "../../measurement/mcp/stdioClient.js";
import {
  commandLineCaseFile,
  configTemplate,
  instructionCaseFile,
  mcpCaseFile,
  WORKFLOW_PATH,
  workflowTemplate,
} from "./initTemplates.js";

export interface InitSummary {
  created: string[];
  skipped: { path: string; reason: string }[];
}

function writeIfAbsent(root: string, relativePath: string, content: string, summary: InitSummary) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  try {
    fs.writeFileSync(target, content, { flag: "wx" });
    summary.created.push(relativePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    summary.skipped.push({ path: relativePath, reason: "já existe" });
  }
}

export async function initializeProject(root: string): Promise<InitSummary> {
  const summary: InitSummary = { created: [], skipped: [] };
  writeIfAbsent(root, CONFIG_RELATIVE_PATH, configTemplate(path.basename(root)), summary);
  const config = loadProjectConfig(root);
  const existingCases = loadCases(config).map((evalCase) => ({ ...evalCase, pending: false }));
  const uncovered = computeCoverage(discoverArtifacts(config), existingCases).filter(
    (entry) => entry.coveredBy.length === 0,
  );

  for (const { artifact } of uncovered) {
    if (artifact.kind === "instruction") {
      const file = instructionCaseFile(artifact);
      writeIfAbsent(root, file.path, file.content, summary);
    } else if (artifact.kind === "cli") {
      const file = commandLineCaseFile(artifact);
      writeIfAbsent(root, file.path, file.content, summary);
    }
  }

  const uncoveredServers = new Set(
    uncovered.filter(({ artifact }) => artifact.kind === "mcp").map(({ artifact }) => artifact.name),
  );
  for (const server of readMcpServers(root).filter(({ name }) => uncoveredServers.has(name))) {
    try {
      const client = await connectMcpServer(server, { cwd: root });
      try {
        const file = mcpCaseFile(server, await client.listTools());
        writeIfAbsent(root, file.path, file.content, summary);
      } finally {
        await client.close();
      }
    } catch (error) {
      summary.skipped.push({
        path: `.mcp.json#${server.name}`,
        reason: `servidor MCP indisponível: ${(error as Error).message}`,
      });
    }
  }

  writeIfAbsent(root, WORKFLOW_PATH, workflowTemplate, summary);
  return summary;
}
