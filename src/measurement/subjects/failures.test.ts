import { describe, expect, it } from "vitest";
import { classifyFailure } from "./failures.js";
import { loadSubjectPackage, MissingSubjectPackageError } from "./packageLoading.js";
import { parseSkillNames } from "./skillListing.js";
import { shortToolName } from "./transcript.js";

const classify = (message: string) => classifyFailure({ timedOut: false, timeoutMs: 0, message }).kind;

describe("failure classification", () => {
  it.each([
    ["You've hit your usage limit", "session-limit"],
    ["429 Too Many Requests", "session-limit"],
    ["401 Unauthorized: invalid credentials", "credential"],
    ["process terminated by SIGKILL", "killed"],
    ["alguma falha", "client-error"],
  ])("classifies %s as %s", (message, kind) => expect(classify(message)).toBe(kind));

  it("prefers timeout when the controller fired", () => {
    expect(classifyFailure({ timedOut: true, timeoutMs: 180000, message: "aborted" })).toEqual({
      kind: "timeout",
      message: "Tempo limite de 180s excedido.",
    });
  });
});

describe("skill listing", () => {
  it("parses bullets, backticks and descriptions, ignoring NENHUMA", () => {
    expect(parseSkillNames("- alpha\n* `beta`\n1. gamma - faz algo\nplugin:delta\n")).toEqual([
      "alpha",
      "beta",
      "gamma",
      "plugin:delta",
    ]);
    expect(parseSkillNames("NENHUMA")).toEqual([]);
  });
});

describe("tool names and package loading", () => {
  it("reduces MCP tool names to the short name", () => {
    expect(shortToolName("mcp__server__lookup")).toBe("lookup");
    expect(shortToolName("Read")).toBe("Read");
  });

  it("explains a missing package with the install line", async () => {
    const importer = () =>
      Promise.reject(Object.assign(new Error("Cannot find package 'x'"), { code: "ERR_MODULE_NOT_FOUND" }));
    const error = await loadSubjectPackage("x", importer).catch((caught) => caught);
    expect(error).toBeInstanceOf(MissingSubjectPackageError);
    expect(error.message).toContain("npm install x");
  });
});
