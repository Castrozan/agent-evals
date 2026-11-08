import { afterEach, describe, expect, it } from "vitest";
import { inheritedEnvironment } from "./inheritedEnvironment.js";

const OPERATOR_VARIABLES = ["CLAUDECODE", "AGENT_EVALS_TEST_SESSION_MARKER", "AGENT_EVALS_TEST_KEPT"];

afterEach(() => {
  for (const name of OPERATOR_VARIABLES) delete process.env[name];
});

describe("inherited subject environment", () => {
  it("drops the operator's session markers and keeps everything else under the case overrides", () => {
    process.env.CLAUDECODE = "1";
    process.env.AGENT_EVALS_TEST_SESSION_MARKER = "/interactive";
    process.env.AGENT_EVALS_TEST_KEPT = "inherited";

    const environment = inheritedEnvironment({
      environment: { AGENT_EVALS_TEST_KEPT: "declared" },
      removedEnvironment: ["AGENT_EVALS_TEST_SESSION_MARKER"],
    });

    expect(environment.CLAUDECODE).toBeUndefined();
    expect(environment.AGENT_EVALS_TEST_SESSION_MARKER).toBeUndefined();
    expect(environment.AGENT_EVALS_TEST_KEPT).toBe("declared");
    expect(environment.PATH).toBe(process.env.PATH);
  });
});
