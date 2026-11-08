import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { SubjectClient, SubjectInvocation } from "../../domain/ports.js";
import type { SessionTranscript } from "../../domain/results.js";
import { runCalibration } from "./calibrate.js";
import { readCalibrationCorpus } from "./corpus.js";
import { grade } from "./grade.js";
import { buildJudgePrompt, parseJudgeVerdict } from "./prompt.js";

const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0 };

function fakeClient(reply: (invocation: SubjectInvocation) => Partial<SessionTranscript>): SubjectClient & {
  invocations: SubjectInvocation[];
} {
  const invocations: SubjectInvocation[] = [];
  return {
    client: "claude",
    invocations,
    async run(invocation) {
      invocations.push(invocation);
      return {
        text: "",
        skillsUsed: [],
        toolsUsed: [],
        commandsRun: [],
        tokenUsage: usage,
        toolOutputCharacters: 0,
        durationMs: 1,
        ...reply(invocation),
      };
    },
    visibleSkills: async () => [],
    sdkVersion: async () => "1",
  };
}

describe("judge prompt", () => {
  it("omits an empty request and states the single-turn rule", () => {
    const prompt = buildJudgePrompt({ criterion: "c", request: "  ", response: "r" });
    expect(prompt).not.toContain("## Pedido");
    expect(prompt).toContain("único turno");
    expect(prompt).toContain("VEREDITO: PASS");
    expect(buildJudgePrompt({ criterion: "c", request: "q", response: "r" })).toContain("## Pedido");
  });
  it("parses the last verdict line in either language", () => {
    expect(parseJudgeVerdict("x\nVEREDITO: PASS")).toBe("pass");
    expect(parseJudgeVerdict("VEREDITO: PASS\nmudei\nVERDICT: FAIL")).toBe("fail");
    expect(parseJudgeVerdict("**VEREDITO: PASS**")).toBe("pass");
    expect(parseJudgeVerdict("talvez")).toBe("no-verdict");
  });
});

describe("grade", () => {
  it("runs isolated without tools and maps failures to no-verdict", async () => {
    const client = fakeClient(() => ({ text: "VEREDITO: FAIL" }));
    const result = await grade(
      { client, model: "m", timeoutMs: 1000, removedEnvironment: [] },
      { criterion: "c", request: "", response: "r" },
    );
    expect(result.verdict).toBe("fail");
    expect(client.invocations[0]).toMatchObject({ posture: "none", isolatedContext: true });
    const failing = fakeClient(() => ({ instrumentFailure: { kind: "timeout", message: "t" } }));
    const failed = await grade(
      { client: failing, model: "m", timeoutMs: 1000, removedEnvironment: [] },
      { criterion: "c", request: "", response: "r" },
    );
    expect(failed.verdict).toBe("no-verdict");
    expect(failed.instrumentFailure?.kind).toBe("timeout");
  });
});

describe("calibration", () => {
  it("reads aliased corpus, excludes no-verdict items and records the worst pass", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "corpus-"));
    const file = path.join(directory, "calibracao.yaml");
    await writeFile(
      file,
      [
        "- {nome: a, pedido: p, saida: aaa, rubrica: r, rotulo: PASS}",
        "- {name: b, request: p, output: bbb, rubric: r, label: FAIL}",
        "- {name: c, output: ccc, rubric: r, label: PASS}",
      ].join("\n"),
    );
    const corpus = readCalibrationCorpus(file);
    expect(corpus.items.map((item) => item.expectedPass)).toEqual([true, false, true]);
    let call = 0;
    const answers = ["pass", "fail", "no", "fail", "fail", "pass"];
    const run = await runCalibration({
      corpus,
      passes: 2,
      judge: { client: "claude" },
      grader: async () => {
        const answer = answers[call++]!;
        return { verdict: answer === "pass" ? "pass" : answer === "fail" ? "fail" : "no-verdict" };
      },
    });
    expect(run.excludedPerPass).toEqual([1, 0]);
    expect(run.passMetrics[0]?.items).toBe(2);
    expect(run.record.kappa).toBe(Math.min(...run.passMetrics.map((metrics) => metrics.kappa)));
    expect(run.record.passes).toBe(2);
    expect(run.flippedItems).toEqual(["a"]);
  });
  it("names a missing corpus", () => {
    expect(() => readCalibrationCorpus("/nonexistent/calibracao.yaml")).toThrow(/não encontrado/);
  });
});
