import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveProjectLocation } from "./repositoryRoot.js";

describe("resolveProjectLocation", () => {
  it("resolves a relative declared config from the repository root, whatever the working directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, "quality/evaluations"), { recursive: true });
    const location = resolveProjectLocation(path.join(root, "quality"), {
      AGENT_EVALS_CONFIG: "quality/evaluations/agent-evals.yaml",
    });
    expect(location).toEqual({ root, configPath: path.join(root, "quality/evaluations/agent-evals.yaml") });
  });

  it("defaults to evals/config.yaml at the root", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "local-"));
    fs.mkdirSync(path.join(root, ".git"));
    expect(resolveProjectLocation(root, {}).configPath).toBe(path.join(root, "evals/config.yaml"));
  });
});
