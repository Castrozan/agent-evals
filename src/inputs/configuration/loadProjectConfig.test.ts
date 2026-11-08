import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectConfig } from "./loadProjectConfig.js";
import { findRepositoryRoot } from "./repositoryRoot.js";
import { normalizePartition } from "./enumAliases.js";

let root: string;

function writeConfig(content: string): void {
  fs.mkdirSync(path.join(root, "evals"), { recursive: true });
  fs.writeFileSync(path.join(root, "evals", "config.yaml"), content);
}

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "config-")));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("loadProjectConfig", () => {
  it("applies every default when the file is absent", () => {
    const config = loadProjectConfig(root);
    expect(config.configPath).toBeUndefined();
    expect(config.baselinePath).toBe("evals/baseline.json");
    expect(config.reportPath).toBe("evals/resultado/relatorio.html");
    expect(config.pagesDirectory).toBe("public");
    expect(config.subject.canonicalClient).toBe("claude");
    expect(config.judge).toMatchObject({ client: "claude", calibrationPath: "evals/calibracao.yaml" });
    expect(config.discovery).toEqual({ instructions: ["CLAUDE.md", "AGENTS.md"], ignore: [] });
    expect(config.validateInstructionFormat).toBe(true);
    expect(config.repetitionsByLevel).toEqual({ unit: 1, integration: 1, "end-to-end": 1 });
    expect(config.thresholds).toMatchObject({ overallFloor: 0.75, criticalFloor: 0.85, maxDrop: 0.05 });
    expect(config.thresholds.minimumRepetitions).toBe(2);
    expect(config.parallelism).toBe(4);
    expect(config.timeoutSeconds).toBe(180);
  });

  it("accepts Portuguese keys and English aliases interchangeably", () => {
    writeConfig(`
projeto: demo
casos:
  pacote: evals/pkg/*.yaml
  skill: [evals/skills/*.yaml]
modelo_padrao: {claude: opus}
esforco_padrao: high
sujeito: {cliente: codex, ambiente: {HOME: "{sessao}"}, ambiente_removido: [SESSION_MARKER]}
execucoes: {ponta-a-ponta: 3, unidade: 2}
limites: {piso_geral: 0.5}
suite_de_testes: {comando: npm test, contagem: "(?<passou>\\\\d+) ok"}
variantes:
  extra-tools: {ambiente: {A: b}, plugins: [{nome: x}]}
`);
    const portuguese = loadProjectConfig(root);
    expect(portuguese.casePatterns.byKind).toEqual({
      package: ["evals/pkg/*.yaml"],
      skill: ["evals/skills/*.yaml"],
    });
    expect(portuguese.defaultEffort).toEqual({ scalar: "high", byClient: {} });
    expect(portuguese.subject).toEqual({
      canonicalClient: "codex",
      environment: { HOME: "{sessao}" },
      removedEnvironment: ["SESSION_MARKER"],
    });
    expect(portuguese.repetitionsByLevel).toEqual({ unit: 2, integration: 1, "end-to-end": 3 });
    expect(portuguese.thresholds.overallFloor).toBe(0.5);
    expect(portuguese.testSuite?.command).toBe("npm test");
    expect(portuguese.variants["extra-tools"]?.plugins[0]?.name).toBe("x");

    writeConfig(`
project: demo
cases: {package: evals/pkg/*.yaml, skill: [evals/skills/*.yaml]}
default_model: {claude: opus}
default_effort: high
subject: {client: codex, environment: {HOME: "{sessao}"}, removed_environment: [SESSION_MARKER]}
repetitions: {end-to-end: 3, unit: 2}
thresholds: {overall_floor: 0.5}
test_suite: {command: npm test, count: "(?<passed>\\\\d+) ok"}
variants:
  extra-tools: {environment: {A: b}, plugins: [{name: x}]}
`);
    const english = loadProjectConfig(root);
    expect({ ...english, testSuite: undefined }).toEqual({ ...portuguese, testSuite: undefined });
  });

  it("rejects both spellings of one key", () => {
    writeConfig("projeto: a\nproject: b\n");
    expect(() => loadProjectConfig(root)).toThrow(/evals\/config.yaml: chave duplicada "project"/);
  });

  it("names the file and nested path of an unknown key", () => {
    writeConfig("limites:\n  piso_geral: 0.5\n  tetp: 1\n");
    expect(() => loadProjectConfig(root)).toThrow('evals/config.yaml: chave desconhecida "limites.tetp"');
  });

  it("translates validation errors to the Portuguese key path", () => {
    writeConfig("limites:\n  piso_geral: muito\n");
    expect(() => loadProjectConfig(root)).toThrow(/"limites.piso_geral": tipo inválido/);
  });

  it("accepts only a YAML boolean for format validation", () => {
    writeConfig('validar_formato_instrucoes: "nao"\n');
    expect(() => loadProjectConfig(root)).toThrow(/validar_formato_instrucoes/);
    writeConfig("validar_formato_instrucoes: false\n");
    expect(loadProjectConfig(root).validateInstructionFormat).toBe(false);
  });

  it("rejects non-kebab variant names and a count pattern without a passed group", () => {
    writeConfig("variantes:\n  Not_Kebab: {}\n");
    expect(() => loadProjectConfig(root)).toThrow(/kebab-case/);
    writeConfig('suite_de_testes: {comando: x, contagem: "\\\\d+"}\n');
    expect(() => loadProjectConfig(root)).toThrow(/passou/);
  });
});

describe("findRepositoryRoot", () => {
  it("prefers the nearest ancestor holding evals/config.yaml over the git top level", () => {
    fs.mkdirSync(path.join(root, ".git"));
    const nested = path.join(root, "packages", "app");
    fs.mkdirSync(path.join(nested, "evals"), { recursive: true });
    fs.writeFileSync(path.join(nested, "evals", "config.yaml"), "");
    const deep = path.join(nested, "src", "deep");
    fs.mkdirSync(deep, { recursive: true });
    expect(findRepositoryRoot(deep)).toBe(nested);
  });

  it("falls back to the git top level", () => {
    fs.mkdirSync(path.join(root, ".git"));
    const deep = path.join(root, "a", "b");
    fs.mkdirSync(deep, { recursive: true });
    expect(findRepositoryRoot(deep)).toBe(root);
  });
});

describe("normalizePartition", () => {
  it("maps both spellings and rejects unknown values", () => {
    expect(normalizePartition("treino")).toBe("train");
    expect(normalizePartition("held-out")).toBe("held-out");
    expect(normalizePartition("reservado")).toBe("held-out");
    expect(() => normalizePartition("x")).toThrow(/partição inválida/);
  });
});
