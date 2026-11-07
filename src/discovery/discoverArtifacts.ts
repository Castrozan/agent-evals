import { ignoredGlobs } from "../configuration/ignoredPaths.js";
import type { DiscoveredArtifact } from "../domain/artifacts.js";
import type { ProjectConfig } from "../domain/project.js";
import { discoverCommandLineTools } from "./cliArtifacts.js";
import { discoverInstructions } from "./instructionArtifacts.js";
import { MCP_CONFIG_FILE, readMcpServers } from "./mcpServers.js";

export function discoverArtifacts(config: ProjectConfig): DiscoveredArtifact[] {
  const ignore = [...ignoredGlobs(config), "evals/**"];
  const mcpServers = readMcpServers(config.root).map((server) => ({
    kind: "mcp" as const,
    path: MCP_CONFIG_FILE,
    name: server.name,
    serverCommand: server.command,
  }));
  return [
    ...discoverInstructions(config.root, config.discovery.instructions, ignore),
    ...discoverCommandLineTools(config.root, ignore),
    ...mcpServers,
  ];
}
