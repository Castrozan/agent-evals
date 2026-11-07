import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import type { Command } from "commander";
import { isClientName, type ClientName } from "../../domain/clients.js";
import { callsModel } from "../../domain/cases.js";
import type { RunRecord } from "../../domain/results.js";
import { createPromptfooExecutor, executeRun, renderPlan } from "../../execution/index.js";
import { detectLeakedSkills, prepareWorkingTree } from "../../isolation/index.js";
import { buildExecutionProfile, profileId } from "../../profile/index.js";
import { createRuntimeServices } from "../../runtime/services.js";
import { createSubjectHome } from "../../staging/index.js";
import { readBaseline, resolveBaselinePath } from "../../baseline/index.js";
import { isCanonicalProfile } from "../../profile/index.js";
import { writeLastRun } from "../lastRun.js";
import { loadProjectContext, type ProjectContext } from "../projectContext.js";
import { publishRunReport } from "../reportAssembly.js";
import { selectRunCases, type RunSelectionOptions } from "./runSelection.js";

export interface RunOptions extends RunSelectionOptions {
  cliente?: string;
  modelo?: string;
  esforco?: string;
  variante?: string;
  revisao?: string;
  execucoes?: string;
  trabalhadores?: string;
  continuar?: boolean;
  pareado?: boolean;
  seco?: boolean;
}

function chosenClient(context: ProjectContext, requested: string | undefined): ClientName {
  if (requested === undefined) return context.config.subject.canonicalClient;
  if (!isClientName(requested)) throw new Error(`cliente desconhecido ${requested}: use claude, codex ou opencode`);
  return requested;
}

function positiveInteger(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${flag} espera um inteiro positivo, recebeu ${value}`);
  return parsed;
}

const write = (line: string) => process.stdout.write(`${line}\n`);

async function probeLeakedSkills(
  client: ClientName,
  model: string,
  workingDirectory: string,
  removedEnvironment: string[],
): Promise<string[]> {
  const services = createRuntimeServices();
  const probeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "agent-evals-sondagem-"));
  const subjectHome = await createSubjectHome(client, []);
  try {
    const visible = await services.clients(client).visibleSkills({
      client,
      model,
      prompt: "",
      workingDirectory: probeDirectory,
      posture: "none",
      stagesGit: false,
      pluginDirectories: [],
      environment: subjectHome.environment,
      removedEnvironment,
      timeoutMs: 120_000,
      isolatedContext: false,
    });
    return detectLeakedSkills(client, visible);
  } catch (error) {
    write(`sondagem de isolamento falhou em ${workingDirectory}: ${(error as Error).message}`);
    return [];
  } finally {
    fs.rmSync(probeDirectory, { recursive: true, force: true });
    await subjectHome.dispose();
  }
}

export async function performRun(context: ProjectContext, options: RunOptions): Promise<RunRecord | undefined> {
  const { config } = context;
  if (options.variante !== undefined && config.variants[options.variante] === undefined) {
    throw new Error(`variante ${options.variante} não declarada em variantes no config`);
  }
  const client = chosenClient(context, options.cliente);
  const profile = buildExecutionProfile(config, client, options.modelo, options.esforco);
  const profileBaseline = readBaseline(
    resolveBaselinePath(config, {
      client,
      profileId: profileId(profile),
      canonical: isCanonicalProfile(config, profile),
      variant: options.variante,
    }),
  );
  const { cases, selection } = selectRunCases(context, options, profileBaseline);
  const workingTree = await prepareWorkingTree(context.root, options.revisao);
  try {
    if (options.revisao === undefined)
      write(`árvore de trabalho isolada com ${workingTree.overlaidPaths.length} caminhos carregados`);
    const variant = options.revisao === undefined ? options.variante : `revisao-${workingTree.commit.slice(0, 12)}`;
    const services = createRuntimeServices();
    const outcome = await executeRun({
      config,
      cases,
      profile,
      clients: services.clients,
      stager: services.stager,
      executor: createPromptfooExecutor({
        compositionModuleUrl: new URL("../../runtime/services.js", import.meta.url).href,
      }),
      workingTreeDirectory: workingTree.directory,
      selection,
      variant,
      revision: options.revisao,
      commit: workingTree.commit,
      overlaidPaths: workingTree.overlaidPaths.length,
      resume: Boolean(options.continuar),
      paired: Boolean(options.pareado),
      workers: positiveInteger(options.trabalhadores, "--trabalhadores"),
      repetitionsMultiplier: positiveInteger(options.execucoes, "--execucoes") ?? 1,
      dryRun: Boolean(options.seco),
      write,
    });
    if (outcome.kind === "plan") {
      write(renderPlan(outcome.plan));
      return undefined;
    }
    const record = outcome.record;
    if (cases.some(callsModel)) {
      record.leakedSkills = await probeLeakedSkills(
        client,
        profile.subject.model,
        workingTree.directory,
        config.subject.removedEnvironment,
      );
    }
    writeLastRun(config, record);
    await publishRunReport(context, record);
    return record;
  } finally {
    await workingTree.dispose();
  }
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function addRunOptions(command: Command): Command {
  return command
    .option("--categoria <nome>", "roda só a categoria; repetível", collect)
    .option("--caso <trecho>", "roda só casos cujo nome contém o trecho; repetível", collect)
    .option("--cliente <cliente>", "claude, codex ou opencode")
    .option("--modelo <modelo>", "modelo do sujeito no cliente escolhido")
    .option("--esforco <esforco>", "esforço do sujeito no cliente escolhido")
    .option("--variante <nome>", "variante declarada em variantes")
    .option("--revisao <ref>", "mede as instruções de outra revisão git como variante")
    .option("--execucoes <n>", "multiplica as repetições de cada caso")
    .option("--trabalhadores <n>", "sessões em paralelo")
    .option("--afetados", "só casos cuja impressão mudou ou cuja evidência venceu")
    .option("--continuar", "retoma a execução interrompida pelo diário")
    .option("--pareado", "mede cada caso também sem a instrução")
    .option("--particao <particao>", "treino ou reservado")
    .option("--seco", "mostra o plano sem chamar modelo");
}

export function registerRunCommand(program: Command): void {
  addRunOptions(program.command("run").description("roda a suíte e publica o relatório")).action(
    async (options: RunOptions) => {
      await performRun(loadProjectContext(), options);
    },
  );
}
