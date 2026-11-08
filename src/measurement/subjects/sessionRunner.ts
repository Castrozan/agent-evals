import type { SubjectInvocation } from "../../domain/ports.js";
import type { InstrumentFailure, SessionTranscript } from "../../domain/results.js";
import { classifyFailure, describeError } from "./failures.js";
import { SubjectConfigurationError } from "./configurationError.js";
import { emptyObservation, toTranscript, type SessionObservation } from "./transcript.js";

export type SessionExecutor = (
  invocation: SubjectInvocation,
  observation: SessionObservation,
  signal: AbortSignal,
) => Promise<InstrumentFailure | undefined>;

export async function runObservedSession(
  invocation: SubjectInvocation,
  execute: SessionExecutor,
): Promise<SessionTranscript> {
  const observation = emptyObservation();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), invocation.timeoutMs);
  const startedAt = Date.now();
  let failure: InstrumentFailure | undefined;
  try {
    failure = await execute(invocation, observation, controller.signal);
  } catch (error) {
    if (error instanceof SubjectConfigurationError) throw error;
    failure = classifyFailure({
      timedOut: controller.signal.aborted,
      timeoutMs: invocation.timeoutMs,
      message: describeError(error),
    });
  } finally {
    clearTimeout(timer);
  }
  if (!failure && controller.signal.aborted) {
    failure = classifyFailure({ timedOut: true, timeoutMs: invocation.timeoutMs, message: "" });
  }
  return toTranscript(observation, Date.now() - startedAt, failure);
}
