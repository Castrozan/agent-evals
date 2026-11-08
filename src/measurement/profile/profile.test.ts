import { describe, expect, it } from "vitest";
import { makeCase, makeConfig } from "../../evidence/verdict/__fixtures__/builders.js";
import { buildExecutionProfile, isCanonicalProfile, profileId } from "./profile.js";
import { resolveSubjectEffort, resolveSubjectModel } from "./resolve.js";

describe("model resolution", () => {
  const config = makeConfig({
    defaultModel: { scalar: "scalar-model", byClient: { codex: "codex-model" } },
  });

  it("follows the spec order for the canonical client", () => {
    const evalCase = makeCase("c", "a", { models: { claude: "per-client" }, model: "case-model" });
    expect(resolveSubjectModel(config, "claude", { evalCase, cliModel: "cli" })).toBe("cli");
    expect(resolveSubjectModel(config, "claude", { evalCase })).toBe("per-client");
    expect(resolveSubjectModel(config, "claude", { evalCase: makeCase("c", "a", { model: "case-model" }) })).toBe(
      "case-model",
    );
    expect(resolveSubjectModel(config, "claude")).toBe("scalar-model");
  });

  it("ignores scalar sources for non-canonical clients", () => {
    const evalCase = makeCase("c", "a", { model: "case-model" });
    expect(resolveSubjectModel(config, "codex", { evalCase })).toBe("codex-model");
    expect(() => resolveSubjectModel(config, "opencode", { evalCase })).toThrow(
      /modelo_padrao\.opencode e modelo_padrao/,
    );
  });

  it("requires provider/model for opencode", () => {
    const opencodeConfig = makeConfig({ defaultModel: { byClient: { opencode: "bare" } } });
    expect(() => resolveSubjectModel(opencodeConfig, "opencode")).toThrow(/provedor\/modelo/);
    expect(resolveSubjectModel(opencodeConfig, "opencode", { cliModel: "a/b" })).toBe("a/b");
  });
});

describe("effort resolution", () => {
  it("validates per client", () => {
    const config = makeConfig({ defaultEffort: { scalar: "high", byClient: {} } });
    expect(resolveSubjectEffort(config, "claude")).toBe("high");
    expect(resolveSubjectEffort(makeConfig(), "claude")).toBeUndefined();
    expect(() => resolveSubjectEffort(config, "claude", { cliEffort: "extreme" })).toThrow(/low, medium/);
    expect(resolveSubjectEffort(makeConfig(), "codex", { cliEffort: "anything" })).toBe("anything");
    expect(() => resolveSubjectEffort(makeConfig(), "opencode", { cliEffort: "high" })).toThrow(/opencode/);
  });
});

describe("execution profile", () => {
  const config = makeConfig();

  it("derives a stable 12 hex digest that ignores undefined effort", () => {
    const profile = buildExecutionProfile(config, "claude");
    expect(profileId(profile)).toMatch(/^[0-9a-f]{12}$/);
    expect(profileId(profile)).toBe(profileId(JSON.parse(JSON.stringify(profile))));
    const reordered = { judge: profile.judge, subject: { model: profile.subject.model, client: "claude" as const } };
    expect(profileId(reordered)).toBe(profileId(profile));
    expect(profileId(buildExecutionProfile(config, "claude", undefined, "high"))).not.toBe(profileId(profile));
  });

  it("recognizes the canonical profile only", () => {
    expect(isCanonicalProfile(config, buildExecutionProfile(config, "claude"))).toBe(true);
    expect(isCanonicalProfile(config, buildExecutionProfile(config, "claude", "other"))).toBe(false);
    expect(isCanonicalProfile(config, buildExecutionProfile(config, "claude", undefined, "max"))).toBe(false);
    const codexConfig = makeConfig({ defaultModel: { scalar: "m", byClient: { codex: "c" } } });
    expect(isCanonicalProfile(codexConfig, buildExecutionProfile(codexConfig, "codex"))).toBe(false);
  });
});
