import type { SubjectInvocation } from "../../domain/ports.js";
import type { InstrumentFailure } from "../../domain/results.js";
import { createIsolatedCodexHome, type IsolatedCodexHome } from "./codexIsolatedHome.js";
import { observeCodexEvent } from "./codexEvents.js";
import { codexClientOptions, codexThreadOptions, requiresSessionSandbox } from "./codexOptions.js";
import { sandboxCodex, type SandboxedCodex } from "./codexSandbox.js";
import { loadSubjectPackage } from "../packageLoading.js";
import type { SessionExecutor } from "../sessionRunner.js";
import { defineSubjectClient } from "../subjectClient.js";

export const CODEX_PACKAGE = "@openai/codex-sdk";

const executeCodex: SessionExecutor = async (invocation, observation, signal) => {
  const { Codex } = await loadSubjectPackage(CODEX_PACKAGE, () => import("@openai/codex-sdk"));
  let isolatedHome: IsolatedCodexHome | undefined;
  let sandbox: SandboxedCodex | undefined;
  try {
    if (invocation.isolatedContext) isolatedHome = await createIsolatedCodexHome(invocation.environment);
    if (requiresSessionSandbox(invocation)) sandbox = await sandboxSession(invocation, isolatedHome?.directory);
    const codex = new Codex(codexClientOptions(invocation, isolatedHome?.directory, sandbox?.binary));
    const thread = codex.startThread(codexThreadOptions(invocation));
    const { events } = await thread.runStreamed(invocation.prompt, { signal });
    let failure: InstrumentFailure | undefined;
    for await (const event of events) failure = observeCodexEvent(event, observation) ?? failure;
    return failure;
  } finally {
    await isolatedHome?.dispose();
    await sandbox?.dispose();
  }
};

function sandboxSession(invocation: SubjectInvocation, isolatedHome?: string): Promise<SandboxedCodex> {
  const codexHome = isolatedHome ?? invocation.environment.CODEX_HOME;
  if (!codexHome) throw new Error("sessão codex sem CODEX_HOME privado não pode ser isolada");
  return sandboxCodex({
    writableRoot: invocation.sessionRoot,
    workingDirectory: invocation.workingDirectory,
    codexHome,
    readableRoots: invocation.pluginDirectories,
    usesPathCodex: invocation.pluginDirectories.length > 0,
  });
}

export const codexSubjectClient = defineSubjectClient({
  client: "codex",
  packageName: CODEX_PACKAGE,
  execute: executeCodex,
});
