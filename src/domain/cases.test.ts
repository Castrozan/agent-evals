import { describe, expect, it } from "vitest";
import { caseKey } from "./cases.js";

describe("caseKey", () => {
  it("joins category and name", () => {
    expect(caseKey({ category: "roteamento", name: "escolhe a skill certa" })).toBe("roteamento/escolhe a skill certa");
  });
});
