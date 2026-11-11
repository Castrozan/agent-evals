import { describe, expect, it } from "vitest";
import { translateEnglishFlags } from "./flagAliases.js";

describe("translateEnglishFlags", () => {
  it("rewrites English long flags to their Portuguese names and keeps values", () => {
    expect(
      translateEnglishFlags(["node", "cli", "run", "--category", "a", "--client=codex", "--report=/r.html", "--seco"]),
    ).toEqual(["node", "cli", "run", "--categoria", "a", "--cliente=codex", "--relatorio=/r.html", "--seco"]);
  });
});
