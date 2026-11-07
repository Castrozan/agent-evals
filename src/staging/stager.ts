import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { callsModel, type EnvironmentDeclaration, type PluginDeclaration } from "../domain/cases.js";
import type { SessionStager, StagedSession, StagingRequest } from "../domain/ports.js";
import { copyEntryFiles } from "./entryFiles.js";
import { rejectUnsupportedOpencodeInputs, subjectEnvironment } from "./environmentVariables.js";
import { applyAdjustments, applyRemovals, writeStagedFiles } from "./workspace/fileEdits.js";
import { initializeRepository } from "./workspace/git.js";
import { applyLayers } from "./workspace/layers.js";
import { prepareCodexHome } from "./plugins/codexHome.js";
import { isInside, resolveInside } from "./pathSafety.js";
import { assemblePlugin, pluginName } from "./plugins/pluginAssembler.js";
import { installSkills } from "./skillInstaller.js";
import { StagingError } from "./stagingError.js";

const EMPTY_ENVIRONMENT: EnvironmentDeclaration = {
  git: false,
  files: [],
  layers: [],
  adjustments: {},
  removals: {},
  plugins: [],
};

function collectPlugins(request: StagingRequest, casePlugins: PluginDeclaration[]) {
  const variantPlugins = request.variantPlugins;
  const caseNames = new Set(casePlugins.map(pluginName));
  for (const plugin of variantPlugins) {
    if (caseNames.has(pluginName(plugin))) {
      throw new StagingError(`O plugin "${pluginName(plugin)}" da variante colide com um plugin do caso.`);
    }
  }
  return [...casePlugins, ...variantPlugins];
}

async function applyGit(root: string, sessionDirectory: string, git: EnvironmentDeclaration["git"]): Promise<void> {
  if (git === true) {
    await initializeRepository(root);
    return;
  }
  if (git === false) return;
  for (const declaration of git) {
    const directory = path.resolve(sessionDirectory, declaration.directory);
    if (!isInside(root, directory)) continue;
    await mkdir(directory, { recursive: true });
    await initializeRepository(directory, declaration.remote);
  }
}

async function assemblePlugins(plugins: PluginDeclaration[], request: StagingRequest, pluginsRoot: string) {
  const directories: string[] = [];
  for (const plugin of plugins) {
    directories.push(await assemblePlugin(plugin, request.client, pluginsRoot, request.sourceRoot));
  }
  return directories;
}

export const sessionStager: SessionStager = {
  async stage(originalRequest: StagingRequest): Promise<StagedSession> {
    const { evalCase, client, sourceRoot, config } = originalRequest;
    const environment = (evalCase.type === "mcp" ? undefined : evalCase.environment) ?? EMPTY_ENVIRONMENT;
    const modelSession = callsModel(evalCase) && evalCase.level !== "unit";
    const stagesEnvironment = !callsModel(evalCase) || modelSession;
    const request: StagingRequest = modelSession
      ? originalRequest
      : { ...originalRequest, variantPlugins: [], variantEnvironment: {} };
    const casePlugins = stagesEnvironment ? environment.plugins : [];
    rejectUnsupportedOpencodeInputs(client, request);
    if (client === "opencode" && casePlugins.length + request.variantPlugins.length > 0) {
      throw new StagingError("O cliente opencode não aceita casos com plugins.");
    }
    const root = await mkdtemp(path.join(os.tmpdir(), "agent-evals-session-"));
    const pluginsRoot = await mkdtemp(path.join(os.tmpdir(), "agent-evals-plugins-"));
    const codexHome = client === "codex" ? await mkdtemp(path.join(os.tmpdir(), "agent-evals-codex-")) : undefined;
    const dispose = async () => {
      for (const directory of [root, pluginsRoot, codexHome]) {
        if (directory) await rm(directory, { recursive: true, force: true });
      }
    };
    try {
      const sessionDirectory = resolveInside(root, environment.sessionIn ?? ".", "diretório da sessão");
      await mkdir(sessionDirectory, { recursive: true });
      if (stagesEnvironment) {
        const treeDeclared = environment.layers.length > 0;
        if (modelSession) {
          const extras = evalCase.instruction
            ? [evalCase.instruction, ...evalCase.extraInstructions]
            : evalCase.extraInstructions;
          await installSkills(client, sessionDirectory, sourceRoot, extras);
          if (!treeDeclared) {
            const overridden = environment.instructions !== undefined;
            await copyEntryFiles(
              root,
              sourceRoot,
              environment.instructions ?? config.discovery.instructions,
              overridden,
            );
          }
        }
        await applyLayers(environment.layers, root, sourceRoot);
        await writeStagedFiles(sessionDirectory, environment.files);
        await applyAdjustments(sessionDirectory, environment.adjustments);
        await applyRemovals(sessionDirectory, environment.removals);
        await applyGit(root, sessionDirectory, environment.git);
      }
      const plugins = collectPlugins(request, casePlugins);
      const pluginDirectories = await assemblePlugins(plugins, request, pluginsRoot);
      const variables = subjectEnvironment(request, sessionDirectory);
      if (codexHome) {
        await prepareCodexHome(codexHome, pluginDirectories);
        variables.CODEX_HOME = codexHome;
      }
      return { root, sessionDirectory, pluginDirectories, environment: variables, dispose };
    } catch (error) {
      await dispose();
      throw error;
    }
  },
};
