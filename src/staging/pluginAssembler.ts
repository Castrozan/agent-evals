import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClientName } from "../domain/clients.js";
import type { PluginDeclaration } from "../domain/cases.js";
import { resolveInside } from "./pathSafety.js";
import { materializeRepository } from "./repositoryMaterializer.js";
import { StagingError } from "./stagingError.js";

const MANIFEST_SCHEMA = "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json";
const TEXT_EXTENSIONS = new Set([".json", ".md", ".sh", ".py", ".js", ".mjs", ".ts", ".toml", ".yaml", ".yml", ".txt"]);

export function pluginName(plugin: PluginDeclaration): string {
  const name = plugin.name ?? (plugin.path ? path.basename(plugin.path) : undefined);
  if (!name) throw new StagingError("Todo plugin declarado precisa de nome.");
  return name;
}

async function exists(target: string): Promise<boolean> {
  return (await stat(target).catch(() => undefined)) !== undefined;
}

async function generatedManifest(pluginRoot: string, name: string): Promise<Record<string, unknown>> {
  const manifest: Record<string, unknown> = { $schema: MANIFEST_SCHEMA, name, version: "1.0.0", description: name };
  if (await exists(path.join(pluginRoot, "skills"))) manifest.skills = "./skills";
  if (await exists(path.join(pluginRoot, "hooks", "hooks.json"))) manifest.hooks = "./hooks/hooks.json";
  if (await exists(path.join(pluginRoot, ".mcp.json"))) manifest.mcpServers = "./.mcp.json";
  return manifest;
}

async function rewriteRootVariable(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await rewriteRootVariable(target);
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      const content = await readFile(target, "utf8");
      if (content.includes("${PLUGIN_ROOT}"))
        await writeFile(target, content.replaceAll("${PLUGIN_ROOT}", "${CLAUDE_PLUGIN_ROOT}"));
    }
  }
}

async function copyFromRepository(plugin: PluginDeclaration, pluginRoot: string, sourceRoot: string): Promise<void> {
  if (plugin.repository) {
    const checkout = `${pluginRoot}.checkout`;
    try {
      await materializeRepository(checkout, plugin.repository, sourceRoot);
      const subdirectory = resolveInside(checkout, plugin.path ?? ".", "caminho do plugin");
      await cp(subdirectory, pluginRoot, {
        recursive: true,
        force: true,
        filter: (source) => path.basename(source) !== ".git",
      });
    } finally {
      await rm(checkout, { recursive: true, force: true });
    }
  }
  for (const directory of plugin.copy) {
    const origin = resolveInside(sourceRoot, directory, "diretório copiado");
    if (!(await exists(origin)))
      throw new StagingError(`O diretório "${directory}" do plugin não existe no repositório.`);
    const target = resolveInside(pluginRoot, directory, "diretório copiado");
    await mkdir(path.dirname(target), { recursive: true });
    await cp(origin, target, { recursive: true, force: true });
  }
  for (const file of plugin.files) {
    const target = resolveInside(pluginRoot, file.path, "arquivo do plugin");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
}

export async function assemblePlugin(
  plugin: PluginDeclaration,
  client: ClientName,
  pluginsRoot: string,
  sourceRoot: string,
): Promise<string> {
  const name = pluginName(plugin);
  const pluginRoot = resolveInside(pluginsRoot, name, "nome do plugin");
  await mkdir(pluginRoot, { recursive: true });
  await copyFromRepository(plugin, pluginRoot, sourceRoot);
  const manifest = `${JSON.stringify(await generatedManifest(pluginRoot, name), null, 2)}\n`;
  await writeFile(path.join(pluginRoot, "plugin.json"), manifest);
  const nativeDirectory = client === "claude" ? ".claude-plugin" : ".codex-plugin";
  await mkdir(path.join(pluginRoot, nativeDirectory), { recursive: true });
  await writeFile(path.join(pluginRoot, nativeDirectory, "plugin.json"), manifest);
  if (client === "claude") await rewriteRootVariable(pluginRoot);
  return pluginRoot;
}
