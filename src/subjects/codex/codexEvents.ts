import type { ThreadEvent, ThreadItem, Usage } from "@openai/codex-sdk";
import type { InstrumentFailure, TokenUsage } from "../../domain/results.js";
import { classifyFailure } from "../failures.js";
import { recordSkill, recordTool, type SessionObservation } from "../transcript.js";

const SKILL_FILE_PATTERN = /skills\/([^/\s'"]+)\/SKILL\.md/g;

export function tokenUsageFromCodex(usage: Usage): TokenUsage {
  const cacheRead = usage.cached_input_tokens;
  const cacheWrite = usage.cache_write_input_tokens;
  const reasoning = usage.reasoning_output_tokens;
  return {
    input: Math.max(usage.input_tokens - cacheRead - cacheWrite, 0),
    output: Math.max(usage.output_tokens - reasoning, 0),
    cacheRead,
    cacheWrite,
    reasoning,
  };
}

function mcpOutputCharacters(item: Extract<ThreadItem, { type: "mcp_tool_call" }>): number {
  const content = item.result?.content ?? [];
  const text = content.reduce((total, block) => total + (block.type === "text" ? block.text.length : 0), 0);
  return text + (item.error?.message.length ?? 0);
}

function observeItem(item: ThreadItem, observation: SessionObservation): void {
  switch (item.type) {
    case "agent_message":
      observation.text = item.text;
      return;
    case "command_execution":
      recordTool(observation, "shell");
      observation.commandsRun.push(item.command);
      observation.toolOutputCharacters += item.aggregated_output.length;
      for (const match of item.command.matchAll(SKILL_FILE_PATTERN)) recordSkill(observation, match[1] ?? "");
      return;
    case "file_change":
      recordTool(observation, "apply_patch");
      return;
    case "mcp_tool_call":
      recordTool(observation, item.tool);
      observation.toolOutputCharacters += mcpOutputCharacters(item);
      return;
    case "web_search":
      recordTool(observation, "web_search");
      return;
    default:
      return;
  }
}

export function observeCodexEvent(event: ThreadEvent, observation: SessionObservation): InstrumentFailure | undefined {
  switch (event.type) {
    case "item.completed":
      observeItem(event.item, observation);
      return undefined;
    case "turn.completed":
      observation.tokenUsage = tokenUsageFromCodex(event.usage);
      return undefined;
    case "turn.failed":
      return classifyFailure({ timedOut: false, timeoutMs: 0, message: event.error.message });
    case "error":
      return classifyFailure({ timedOut: false, timeoutMs: 0, message: event.message });
    default:
      return undefined;
  }
}
