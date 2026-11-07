import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { InstrumentFailure, TokenUsage } from "../domain/results.js";
import { classifyFailure } from "./failures.js";
import { recordSkill, recordTool, addTokenUsage, type SessionObservation } from "./transcript.js";

interface ContentBlock {
  type: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
}

interface ModelUsageEntry {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
}

function contentBlocks(message: { content?: unknown }): ContentBlock[] {
  return Array.isArray(message.content) ? (message.content as ContentBlock[]) : [];
}

function toolResultCharacters(content: unknown): number {
  if (typeof content === "string") return content.length;
  if (!Array.isArray(content)) return 0;
  return content.reduce((total: number, part: { type?: string; text?: string }) => {
    return total + (part.type === "text" && typeof part.text === "string" ? part.text.length : 0);
  }, 0);
}

function skillName(input: Record<string, unknown> | undefined): string {
  const value = input?.skill ?? input?.name ?? input?.command;
  return typeof value === "string" ? value : "";
}

export function tokenUsageFromModelUsage(modelUsage: Record<string, ModelUsageEntry> | undefined): TokenUsage {
  const total: TokenUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
  for (const usage of Object.values(modelUsage ?? {})) {
    const reasoning = usage.thinkingTokens ?? 0;
    addTokenUsage(total, {
      input: usage.inputTokens,
      output: Math.max(usage.outputTokens - reasoning, 0),
      cacheRead: usage.cacheReadInputTokens,
      cacheWrite: usage.cacheCreationInputTokens,
      reasoning,
    });
  }
  return total;
}

export function observeClaudeMessage(
  message: SDKMessage,
  observation: SessionObservation,
): InstrumentFailure | undefined {
  if (message.type === "assistant") {
    for (const block of contentBlocks(message.message)) {
      if (block.type !== "tool_use" || !block.name) continue;
      recordTool(observation, block.name);
      if (block.name === "Skill") recordSkill(observation, skillName(block.input));
      const command = (block.input as { command?: unknown } | undefined)?.command;
      if (block.name === "Bash" && typeof command === "string") observation.commandsRun.push(command);
    }
    return undefined;
  }
  if (message.type === "user") {
    for (const block of contentBlocks(message.message as { content?: unknown })) {
      if (block.type === "tool_result") observation.toolOutputCharacters += toolResultCharacters(block.content);
    }
    return undefined;
  }
  if (message.type !== "result") return undefined;
  observation.tokenUsage = tokenUsageFromModelUsage(message.modelUsage as Record<string, ModelUsageEntry>);
  observation.costUsd = message.total_cost_usd;
  if (message.subtype === "success" && !message.is_error) {
    observation.text = message.result;
    return undefined;
  }
  const detail = message.subtype === "success" ? message.result : message.errors.join("\n") || message.subtype;
  if (message.subtype === "success") observation.text = "";
  return classifyFailure({ timedOut: false, timeoutMs: 0, message: detail });
}
