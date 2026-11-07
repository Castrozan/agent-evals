import { execFileSync } from "node:child_process";
import path from "node:path";
import type { Command } from "commander";
import {
  buildPagesDirectory,
  buildSnapshotEvent,
  pagesUrl,
  publishSnapshot,
  readReportDocument,
  readmeBadgeLine,
  reportPathsFor,
  runTestSuite,
  saveTestSuiteCard,
} from "../reporting/index.js";
import { readLastRun } from "./lastRun.js";
import { loadProjectContext } from "./projectContext.js";
import { publishRunReport } from "./reportAssembly.js";

function gitOutput(root: string, gitArguments: string[]): string | undefined {
  try {
    return execFileSync("git", gitArguments, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

export function registerReportCommands(program: Command): void {
  program
    .command("relatorio")
    .alias("report")
    .description("republica a página a partir da última execução, sem chamar modelo")
    .action(async () => {
      const context = loadProjectContext();
      await publishRunReport(context, readLastRun(context.config));
    });

  program
    .command("paginas")
    .alias("pages")
    .description("monta o diretório publicável e imprime a URL e a linha do selo para o README")
    .option("--diretorio", "imprime só o diretório publicável")
    .action(async (options: { diretorio?: boolean }) => {
      const context = loadProjectContext();
      const directory = await buildPagesDirectory(context.config);
      if (options.diretorio) {
        process.stdout.write(`${path.relative(context.root, directory)}\n`);
        return;
      }
      const url = pagesUrl(context.config, gitOutput(context.root, ["remote", "get-url", "origin"]) ?? "");
      process.stdout.write(
        `publicável em ${path.relative(context.root, directory)}\n${url}\n${readmeBadgeLine(url)}\n`,
      );
    });

  program
    .command("testes")
    .alias("tests")
    .description("roda a suíte de testes tradicional declarada e publica o resultado na página")
    .action(async () => {
      const context = loadProjectContext();
      const declaration = context.config.testSuite;
      if (!declaration) throw new Error("declare suite_de_testes no evals/config.yaml");
      const reportPath = path.resolve(context.root, context.config.reportPath);
      const { card, output } = await runTestSuite(
        declaration,
        context.root,
        gitOutput(context.root, ["rev-parse", "HEAD"]),
      );
      process.stdout.write(output);
      await saveTestSuiteCard(reportPath, card);
      try {
        await publishRunReport(context, readLastRun(context.config));
      } catch {
        process.stdout.write("sem execução de evals ainda; o cartão entra na próxima página\n");
      }
      process.exitCode = card.exitCode;
    });

  program
    .command("snapshot")
    .description("envia o retrato da última medição ao serviço de ingestão declarado")
    .action(async () => {
      const context = loadProjectContext();
      const url = context.config.snapshot?.url;
      if (!url) throw new Error("declare snapshot.url no evals/config.yaml");
      const { jsonPath } = reportPathsFor(path.resolve(context.root, context.config.reportPath));
      await publishSnapshot(url, buildSnapshotEvent(await readReportDocument(jsonPath)));
      process.stdout.write("retrato enviado\n");
    });
}
