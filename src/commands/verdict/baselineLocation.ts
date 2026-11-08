import { readBaseline, resolveBaselinePath } from "../../evidence/baseline/index.js";
import type { Baseline } from "../../domain/baseline.js";
import type { RunRecord } from "../../domain/results.js";
import { isCanonicalProfile } from "../../measurement/profile/index.js";
import type { ProjectContext } from "../projectContext.js";

export function baselinePathForRun(context: ProjectContext, run: RunRecord): string {
  return resolveBaselinePath(context.config, {
    client: run.profile.subject.client,
    profileId: run.profileId,
    canonical: isCanonicalProfile(context.config, run.profile),
    variant: run.variant,
  });
}

export function baselineForRun(context: ProjectContext, run: RunRecord): Baseline | undefined {
  return readBaseline(baselinePathForRun(context, run));
}
