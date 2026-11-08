import { rm } from "node:fs/promises";
import path from "node:path";
import type { ClientName } from "../../../domain/clients.js";
import { prepareCodexHome } from "./codexHome.js";
import { createScratchDirectory } from "../../runtime/scratch.js";

export interface SubjectHome {
  environment: Record<string, string>;
  dispose(): Promise<void>;
}

const SHARED_USER_HOME: SubjectHome = { environment: {}, dispose: async () => {} };

export async function createSubjectHome(client: ClientName, pluginDirectories: string[]): Promise<SubjectHome> {
  if (client !== "codex") return SHARED_USER_HOME;
  const codexHome = await createScratchDirectory("agent-evals-codex-");
  const dispose = () => rm(codexHome, { recursive: true, force: true });
  try {
    await prepareCodexHome(codexHome, pluginDirectories);
  } catch (error) {
    await dispose();
    throw error;
  }
  return { environment: { CODEX_HOME: codexHome }, dispose };
}
