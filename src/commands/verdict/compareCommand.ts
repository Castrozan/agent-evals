import type { Command } from "commander";
import { readBaseline, resolveBaselinePath } from "../../evidence/baseline/index.js";
import {
  compareExitCode,
  compareVariants,
  missingVariantMessage,
  renderComparisonJson,
  renderComparisonText,
} from "../../measurement/compare/index.js";
import type { Baseline } from "../../domain/baseline.js";
import { buildExecutionProfile, profileId } from "../../measurement/profile/index.js";
import { loadProjectContext, type ProjectContext } from "../projectContext.js";

const CANONICAL_VARIANT = "canonica";

function variantBaseline(context: ProjectContext, variant: string): Baseline {
  const client = context.config.subject.canonicalClient;
  const baselinePath = resolveBaselinePath(context.config, {
    client,
    profileId: profileId(buildExecutionProfile(context.config, client)),
    canonical: true,
    variant: variant === CANONICAL_VARIANT ? undefined : variant,
  });
  const baseline = readBaseline(baselinePath);
  if (!baseline) throw new Error(missingVariantMessage(variant));
  return baseline;
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

export function registerCompareCommand(program: Command): void {
  program
    .command("compare")
    .description("compara caso a caso a baseline de duas variantes; use canonica para a baseline sem variante")
    .requiredOption("--variante <nome>", "variante a comparar, duas vezes: antes e depois", collect)
    .option("--formato <formato>", "texto ou json", "texto")
    .action((options: { variante: string[]; formato: string }) => {
      if (options.variante.length !== 2) throw new Error("informe exatamente duas variantes com --variante");
      const context = loadProjectContext();
      const [before, after] = options.variante as [string, string];
      const comparison = compareVariants(variantBaseline(context, before), variantBaseline(context, after));
      const json = options.formato === "json";
      process.stdout.write(`${json ? renderComparisonJson(comparison) : renderComparisonText(comparison)}\n`);
      process.exitCode = compareExitCode(comparison);
    });
}
