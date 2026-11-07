import type { ClientName } from "../domain/clients.js";
import type { SubjectClient } from "../domain/ports.js";
import { claudeSubjectClient } from "./claudeClient.js";
import { codexSubjectClient } from "./codexClient.js";
import { opencodeSubjectClient } from "./opencodeClient.js";

const SUBJECT_CLIENTS: Record<ClientName, SubjectClient> = {
  claude: claudeSubjectClient,
  codex: codexSubjectClient,
  opencode: opencodeSubjectClient,
};

export function createSubjectClient(client: ClientName): SubjectClient {
  return SUBJECT_CLIENTS[client];
}

export { classifyFailure } from "./failures.js";
export { SubjectConfigurationError } from "./configurationError.js";
export { MissingSubjectPackageError } from "./packageLoading.js";
export { parseSkillNames, SKILL_LISTING_PROMPT } from "./skillListing.js";
