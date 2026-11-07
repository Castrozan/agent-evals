import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { InstrumentFailure } from "../../domain/results.js";
import { observeClaudeMessage } from "./claudeMessages.js";
import { claudeQueryOptions } from "./claudeOptions.js";
import { loadSubjectPackage } from "../packageLoading.js";
import type { SessionExecutor } from "../sessionRunner.js";
import { defineSubjectClient } from "../subjectClient.js";

export const CLAUDE_PACKAGE = "@anthropic-ai/claude-agent-sdk";

const executeClaude: SessionExecutor = async (invocation, observation, signal) => {
  const { query } = await loadSubjectPackage(CLAUDE_PACKAGE, () => import("@anthropic-ai/claude-agent-sdk"));
  const controller = new AbortController();
  signal.addEventListener("abort", () => controller.abort(), { once: true });
  let agentQuery: Query | undefined;
  let failure: InstrumentFailure | undefined;
  let finished = false;
  try {
    agentQuery = query({ prompt: invocation.prompt, options: claudeQueryOptions(invocation, controller) });
    for await (const message of agentQuery) {
      failure = observeClaudeMessage(message, observation) ?? failure;
      if (message.type === "result") finished = true;
    }
  } finally {
    agentQuery?.close();
  }
  if (!finished && !failure) {
    return { kind: "client-error", message: "A sessão do claude terminou sem mensagem de resultado." };
  }
  return failure;
};

export const claudeSubjectClient = defineSubjectClient({
  client: "claude",
  packageName: CLAUDE_PACKAGE,
  execute: executeClaude,
});
