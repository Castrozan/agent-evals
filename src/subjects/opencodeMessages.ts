import type { SessionMessageInfo } from "@opencode/client";
import { describeError } from "./failures.js";
import { addTokenUsage, recordSkill, recordTool, type SessionObservation } from "./transcript.js";

type AssistantMessage = Extract<SessionMessageInfo, { type: "assistant" }>;

function assistantText(message: AssistantMessage): string {
  return message.content.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n");
}

function toolOutputCharacters(content: ReadonlyArray<{ type: string; text?: string }> | undefined): number {
  return (content ?? []).reduce((total, part) => total + (part.type === "text" ? (part.text?.length ?? 0) : 0), 0);
}

function observeAssistant(message: AssistantMessage, observation: SessionObservation): void {
  observation.text = assistantText(message);
  for (const part of message.content) {
    if (part.type !== "tool") continue;
    recordTool(observation, part.name);
    const state = part.state as { input?: Record<string, unknown>; content?: Array<{ type: string; text?: string }> };
    if (part.name === "skill" && typeof state.input?.name === "string") recordSkill(observation, state.input.name);
    observation.toolOutputCharacters += toolOutputCharacters(state.content);
  }
  if (message.tokens) {
    addTokenUsage(observation.tokenUsage, {
      input: message.tokens.input,
      output: message.tokens.output,
      cacheRead: message.tokens.cache.read,
      cacheWrite: message.tokens.cache.write,
      reasoning: message.tokens.reasoning,
    });
  }
  if (message.cost !== undefined) observation.costUsd = (observation.costUsd ?? 0) + message.cost;
}

export function observeOpencodeMessages(
  messages: SessionMessageInfo[],
  observation: SessionObservation,
): string | undefined {
  let errorMessage: string | undefined;
  for (const message of messages) {
    if (message.type === "skill") recordSkill(observation, message.name);
    if (message.type !== "assistant") continue;
    observeAssistant(message, observation);
    if (message.error) errorMessage = describeError(message.error);
  }
  return errorMessage;
}
