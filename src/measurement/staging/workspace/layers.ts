import { cp, mkdir, stat } from "node:fs/promises";
import type { StagingLayer } from "../../../domain/cases.js";
import { initializeRepository } from "./git.js";
import { resolveInside } from "../pathSafety.js";
import { materializeRepository } from "./repositoryMaterializer.js";
import { StagingError } from "../stagingError.js";

export async function applyLayers(layers: StagingLayer[], root: string, sourceRoot: string): Promise<void> {
  for (const [index, layer] of layers.entries()) {
    if (layer.at === undefined && index > 0) {
      throw new StagingError(`A camada ${index + 1} precisa declarar "em": só a primeira pode omiti-lo.`);
    }
    const destination = resolveInside(root, layer.at ?? ".", "destino da camada");
    await mkdir(destination, { recursive: true });
    if (layer.from !== undefined) {
      const origin = resolveInside(sourceRoot, layer.from, "caminho de origem da camada");
      if (!(await stat(origin).catch(() => undefined))) {
        throw new StagingError(`A origem da camada "${layer.from}" não existe no repositório avaliado.`);
      }
      await cp(origin, destination, { recursive: true, force: true });
    }
    if (layer.repository) await materializeRepository(destination, layer.repository, sourceRoot);
    if (layer.git) {
      const repositoryDirectory = resolveInside(destination, layer.git.directory, "diretório git da camada");
      await mkdir(repositoryDirectory, { recursive: true });
      await initializeRepository(repositoryDirectory, layer.git.remote);
    }
  }
}
