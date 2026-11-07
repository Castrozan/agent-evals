import type { SessionMessageInfo } from "@opencode/client";
import { classifyFailure } from "../failures.js";
import {
  OPENCODE_AGENT_NAME,
  opencodeServerConfiguration,
  splitOpencodeModel,
  validateOpencodeInvocation,
} from "./opencodeConfig.js";
import { observeOpencodeMessages } from "./opencodeMessages.js";
import { startOpencodeServer } from "./opencodeServer.js";
import { loadSubjectPackage } from "../packageLoading.js";
import type { SessionExecutor } from "../sessionRunner.js";
import { defineSubjectClient } from "../subjectClient.js";

export const OPENCODE_PACKAGE = "@opencode/client";

const MESSAGE_PAGE_SIZE = 100;

const executeOpencode: SessionExecutor = async (invocation, observation, signal) => {
  validateOpencodeInvocation(invocation);
  const model = splitOpencodeModel(invocation.model);
  const { OpenCode } = await loadSubjectPackage(OPENCODE_PACKAGE, () => import("@opencode/client"));
  const server = await startOpencodeServer({
    directory: invocation.workingDirectory,
    configuration: opencodeServerConfiguration(invocation),
    signal,
  });
  try {
    const client = OpenCode.make({
      baseUrl: server.baseUrl,
      headers: { Authorization: `Basic ${Buffer.from(`opencode:${server.password}`).toString("base64")}` },
    });
    const options = { signal };
    const session = await client.session.create(
      { location: { directory: invocation.workingDirectory }, agent: OPENCODE_AGENT_NAME, model },
      options,
    );
    await client.session.prompt({ sessionID: session.id, text: invocation.prompt }, options);
    await client.experimental.session.wait({ sessionID: session.id }, options);
    const messages: SessionMessageInfo[] = [];
    let cursor: string | undefined;
    do {
      const page = await client.message.list(
        { sessionID: session.id, order: "asc", limit: MESSAGE_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
        options,
      );
      messages.push(...page.data);
      cursor = page.cursor.next ?? undefined;
    } while (cursor);
    const errorMessage = observeOpencodeMessages(messages, observation);
    if (errorMessage) return classifyFailure({ timedOut: false, timeoutMs: 0, message: errorMessage });
    return undefined;
  } finally {
    await server.close();
  }
};

export const opencodeSubjectClient = defineSubjectClient({
  client: "opencode",
  packageName: OPENCODE_PACKAGE,
  execute: executeOpencode,
});
