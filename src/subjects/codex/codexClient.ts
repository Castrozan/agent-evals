import type { InstrumentFailure } from "../../domain/results.js";
import { createIsolatedCodexHome, type IsolatedCodexHome } from "./codexIsolatedHome.js";
import { observeCodexEvent } from "./codexEvents.js";
import { codexClientOptions, codexThreadOptions } from "./codexOptions.js";
import { loadSubjectPackage } from "../packageLoading.js";
import type { SessionExecutor } from "../sessionRunner.js";
import { defineSubjectClient } from "../subjectClient.js";

export const CODEX_PACKAGE = "@openai/codex-sdk";

const executeCodex: SessionExecutor = async (invocation, observation, signal) => {
  const { Codex } = await loadSubjectPackage(CODEX_PACKAGE, () => import("@openai/codex-sdk"));
  let isolatedHome: IsolatedCodexHome | undefined;
  try {
    if (invocation.isolatedContext) isolatedHome = await createIsolatedCodexHome(invocation.environment);
    const codex = new Codex(codexClientOptions(invocation, isolatedHome?.directory));
    const thread = codex.startThread(codexThreadOptions(invocation));
    const { events } = await thread.runStreamed(invocation.prompt, { signal });
    let failure: InstrumentFailure | undefined;
    for await (const event of events) failure = observeCodexEvent(event, observation) ?? failure;
    return failure;
  } finally {
    await isolatedHome?.dispose();
  }
};

export const codexSubjectClient = defineSubjectClient({
  client: "codex",
  packageName: CODEX_PACKAGE,
  execute: executeCodex,
});
