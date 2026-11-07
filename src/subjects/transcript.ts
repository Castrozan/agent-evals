import type { InstrumentFailure, SessionTranscript, TokenUsage } from "../domain/results.js";

export interface SessionObservation {
  text: string;
  skillsUsed: string[];
  toolsUsed: string[];
  tokenUsage: TokenUsage;
  toolOutputCharacters: number;
  costUsd?: number;
}

export function emptyTokenUsage(): TokenUsage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };
}

export function emptyObservation(): SessionObservation {
  return { text: "", skillsUsed: [], toolsUsed: [], tokenUsage: emptyTokenUsage(), toolOutputCharacters: 0 };
}

export function shortToolName(name: string): string {
  const match = /^mcp__.+?__(.+)$/.exec(name);
  return match?.[1] ?? name;
}

export function recordTool(observation: SessionObservation, name: string): void {
  const shortName = shortToolName(name);
  if (!observation.toolsUsed.includes(shortName)) observation.toolsUsed.push(shortName);
}

export function recordSkill(observation: SessionObservation, name: string): void {
  if (name !== "" && !observation.skillsUsed.includes(name)) observation.skillsUsed.push(name);
}

export function addTokenUsage(target: TokenUsage, addition: TokenUsage): void {
  target.input += addition.input;
  target.output += addition.output;
  target.cacheRead += addition.cacheRead;
  target.cacheWrite += addition.cacheWrite;
  target.reasoning += addition.reasoning;
}

export function toTranscript(
  observation: SessionObservation,
  durationMs: number,
  instrumentFailure?: InstrumentFailure,
): SessionTranscript {
  return { ...observation, durationMs, ...(instrumentFailure ? { instrumentFailure } : {}) };
}
