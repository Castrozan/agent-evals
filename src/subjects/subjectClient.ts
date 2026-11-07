import type { ClientName } from "../domain/clients.js";
import type { SubjectClient, SubjectInvocation } from "../domain/ports.js";
import { readInstalledVersion } from "./packageLoading.js";
import { runObservedSession, type SessionExecutor } from "./sessionRunner.js";
import { SKILL_LISTING_PROMPT, parseSkillNames } from "./skillListing.js";

export interface SubjectClientSpecification {
  client: ClientName;
  packageName: string;
  execute: SessionExecutor;
}

export function defineSubjectClient({ client, packageName, execute }: SubjectClientSpecification): SubjectClient {
  const run = (invocation: SubjectInvocation) => runObservedSession(invocation, execute);
  return {
    client,
    run,
    async visibleSkills(invocation) {
      const transcript = await run({
        ...invocation,
        systemPrompt: undefined,
        prompt: SKILL_LISTING_PROMPT,
        posture: "read-only",
      });
      if (transcript.instrumentFailure) {
        throw new Error(`Não foi possível listar as skills visíveis: ${transcript.instrumentFailure.message}`);
      }
      return parseSkillNames(transcript.text);
    },
    async sdkVersion() {
      return readInstalledVersion(packageName);
    },
  };
}
