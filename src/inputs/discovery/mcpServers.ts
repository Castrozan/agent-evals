import fs from "node:fs";
import path from "node:path";
import type { McpServerDeclaration } from "../../domain/cases.js";

export const MCP_CONFIG_FILE = ".mcp.json";

interface RawMcpServer {
  command?: unknown;
  args?: unknown;
  env?: unknown;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function stringMap(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export function readMcpServers(root: string): McpServerDeclaration[] {
  const configPath = path.join(root, MCP_CONFIG_FILE);
  if (!fs.existsSync(configPath)) return [];
  const document = JSON.parse(fs.readFileSync(configPath, "utf8")) as {
    mcpServers?: Record<string, RawMcpServer>;
  };
  return Object.entries(document.mcpServers ?? {})
    .filter(([, server]) => typeof server.command === "string")
    .map(([name, server]) => ({
      name,
      command: [server.command as string, ...stringList(server.args)],
      environment: stringMap(server.env),
    }));
}
