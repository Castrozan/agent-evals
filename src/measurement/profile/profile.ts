import type { ClientName, ExecutionProfile } from "../../domain/clients.js";
import type { ProjectConfig } from "../../domain/project.js";
import { canonicalJson, sha256Hex } from "../../inputs/fingerprint/canonical.js";
import { resolveSubjectEffort, resolveSubjectModel } from "./resolve.js";

const PROFILE_ID_LENGTH = 12;

export function buildExecutionProfile(
  config: ProjectConfig,
  client: ClientName,
  cliModel?: string,
  cliEffort?: string,
): ExecutionProfile {
  const overrides = { cliModel, cliEffort };
  return {
    subject: {
      client,
      model: resolveSubjectModel(config, client, overrides),
      effort: resolveSubjectEffort(config, client, overrides),
    },
    judge: { client: config.judge.client, model: config.judge.model, effort: config.judge.effort },
  };
}

export function profileId(profile: ExecutionProfile): string {
  return sha256Hex(canonicalJson(profile)).slice(0, PROFILE_ID_LENGTH);
}

export function isCanonicalProfile(config: ProjectConfig, profile: ExecutionProfile): boolean {
  const canonicalClient = config.subject.canonicalClient;
  if (profile.subject.client !== canonicalClient) return false;
  let canonical: ExecutionProfile;
  try {
    canonical = buildExecutionProfile(config, canonicalClient);
  } catch {
    return false;
  }
  return profileId(canonical) === profileId(profile);
}
