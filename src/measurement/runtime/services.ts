import type { RuntimeServices } from "../execution/promptfoo/jobSample.js";
import { sessionStager } from "../staging/index.js";
import { createSubjectClient } from "../subjects/index.js";

export function createRuntimeServices(): RuntimeServices {
  return { clients: createSubjectClient, stager: sessionStager };
}
