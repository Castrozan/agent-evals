import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProjectConfig } from "../configuration/loadProjectConfig.js";
import { listPendingCases, selectCases } from "./caseSelection.js";
import { loadCases } from "./loadCases.js";
import { findRubricViolations } from "./rubricGuard.js";

let root: string;

function write(relativePath: string, content: string): void {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function load() {
  return loadCases(loadProjectConfig(root));
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "cases-"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("loadCases", () => {
  it("normalizes Portuguese and English spellings to the same case", () => {
    write(
      "evals/a.yaml",
      `categoria: roteamento
casos:
  - nome: usa a skill
    pergunta: faça algo
    nivel: ponta-a-ponta
    execucoes: 3
    reservado: true
    assercoes:
      juiz: [responde bem]
      skills_usadas: [deploy]
`,
    );
    write(
      "evals/b.yaml",
      `category: roteamento
cases:
  - name: usa a skill
    prompt: faça algo
    level: end-to-end
    repetitions: 3
    held_out: true
    type: instruction
    assertions:
      judge: [responde bem]
      skills_used: [deploy]
`,
    );
    const config = loadProjectConfig(root);
    expect(() => loadCases(config)).toThrow(
      /caso duplicado "roteamento\/usa a skill" em evals\/a.yaml e evals\/b.yaml/,
    );
    fs.rmSync(path.join(root, "evals/b.yaml"));
    const [evalCase] = loadCases(config);
    expect(evalCase).toMatchObject({
      type: "instruction",
      level: "end-to-end",
      repetitions: 3,
      heldOut: true,
      pending: false,
      sourceFile: "evals/a.yaml",
      assertions: { judge: ["responde bem"], skillsUsed: ["deploy"], contains: [] },
    });
  });

  it("ignores YAML files without a casos key and ignored directories", () => {
    write("evals/other.yaml", "chave: valor\n");
    write("evals/resultado/x.yaml", "categoria: x\ncasos: []\n");
    write("evals/node_modules/y.yaml", "categoria: x\ncasos: []\n");
    write("evals/skipped/z.yaml", "categoria: x\ncasos: [{nome: a, pergunta: b}]\n");
    write("evals/config.yaml", "descoberta: {ignorar: ['evals/skipped/**']}\n");
    expect(load()).toEqual([]);
  });

  it("loads cli and mcp cases with defaults", () => {
    write(
      "evals/c.yaml",
      `categoria: ferramentas
casos:
  - {nome: ajuda, tipo: cli, comando: tool --help, assercoes: {contem: [uso]}}
  - nome: servidor
    tipo: mcp
    servidor: {nome: s, comando: [node, s.js]}
    contrato: [{nome: eco, obrigatorios: [texto]}]
    chamadas: [{ferramenta: eco, argumentos: {texto: oi}, contem: [oi]}]
`,
    );
    const [cli, mcp] = load();
    expect(cli).toMatchObject({ type: "cli", exitCode: 0, level: "unit" });
    expect(cli?.type === "cli" && cli.assertions.contains).toEqual(["uso"]);
    expect(mcp).toMatchObject({
      type: "mcp",
      strict: false,
      server: { name: "s", environment: {} },
      contract: [{ name: "eco", required: ["texto"] }],
      calls: [{ tool: "eco", arguments: { texto: "oi" }, contains: ["oi"] }],
    });
  });

  it("reports unknown keys and type mismatches with the Portuguese key path", () => {
    write("evals/c.yaml", "categoria: c\ncasos:\n  - {nome: a, pergunta: b, bogus: 1}\n");
    expect(() => load()).toThrow('evals/c.yaml: chave desconhecida "casos[0].bogus"');
    write("evals/c.yaml", "categoria: c\ncasos:\n  - {nome: a, tipo: cli, comando: x, pergunta: y}\n");
    expect(() => load()).toThrow(/evals\/c.yaml: chave desconhecida "casos\[0\].pergunta"/);
    write("evals/c.yaml", "categoria: c\ncasos:\n  - {nome: a, tipo: instrucao}\n");
    expect(() => load()).toThrow(/"casos\[0\].pergunta"/);
  });

  it("applies per-kind rules", () => {
    write("evals/config.yaml", "casos:\n  skill: evals/skills/*.yaml\n  pacote: evals/pkg/*.yaml\n");
    write(
      "evals/skills/a.yaml",
      "categoria: s\ncasos:\n  - {nome: a, pergunta: p, instrucao: skills/x/SKILL.md}\n  - {nome: c, tipo: cli, comando: x}\n",
    );
    write(
      "evals/pkg/a.yaml",
      "categoria: p\ncasos:\n  - {nome: a, pergunta: p, nivel: integracao, ambiente: {plugin: {nome: x}}}\n  - {nome: u, pergunta: p}\n",
    );
    const cases = load();
    expect(cases.map((evalCase) => evalCase.environmentKind)).toEqual(["package", "package", "skill", "skill"]);

    write("evals/skills/a.yaml", "categoria: s\ncasos:\n  - {nome: a, pergunta: p, instrucao: 'skills/*/SKILL.md'}\n");
    expect(() => load()).toThrow(/s\/a: casos de skill devem apontar/);
    write(
      "evals/skills/a.yaml",
      "categoria: s\ncasos:\n  - {nome: a, pergunta: p, instrucao: x/SKILL.md, ambiente: {plugins: [{nome: x}]}}\n",
    );
    expect(() => load()).toThrow(/não podem declarar plugin/);
    write("evals/skills/a.yaml", "categoria: s\ncasos: []\n");
    write("evals/pkg/a.yaml", "categoria: p\ncasos:\n  - {nome: a, pergunta: p, nivel: ponta-a-ponta}\n");
    expect(() => load()).toThrow(/devem declarar plugin ou plugins/);
  });
});

describe("igual assertion", () => {
  it("accepts a string or a list and defaults to empty", () => {
    write(
      "evals/e.yaml",
      "categoria: e\ncasos:\n  - {nome: a, pergunta: p, assercoes: {igual: ok}}\n  - {nome: b, pergunta: p, assercoes: {equals: [x, y]}}\n  - {nome: c, pergunta: p}\n",
    );
    const equals = load().map((evalCase) => (evalCase.type === "instruction" ? evalCase.assertions.equals : undefined));
    expect(equals).toEqual([["ok"], ["x", "y"], []]);
  });
});

describe("rubric guard and selection", () => {
  beforeEach(() => {
    write(
      "evals/a.yaml",
      `categoria: g
casos:
  - {nome: bag, pergunta: p, assercoes: {contem: [x]}}
  - {nome: bag pendente, pergunta: p, pendente: true, assercoes: {contem: [x]}}
  - {nome: rubric, pergunta: p, reservado: true, assercoes: {juiz: [ok], contem: [x]}}
  - {nome: integ, pergunta: p, nivel: integracao, assercoes: {contem: [x]}}
  - {nome: pendente sem pergunta, pendente: true}
`,
    );
  });

  it("flags unit instruction cases that replace a rubric with substrings", () => {
    const violations = findRubricViolations(load());
    expect(violations.map((violation) => violation.name)).toEqual(["bag"]);
    expect(violations[0]?.message).toContain("evals/a.yaml");
  });

  it("selects by category, name substring and partition, never pending", () => {
    const cases = load();
    expect(selectCases(cases).map((evalCase) => evalCase.name)).toEqual(["bag", "rubric", "integ"]);
    expect(selectCases(cases, { partition: "held-out" }).map((evalCase) => evalCase.name)).toEqual(["rubric"]);
    expect(selectCases(cases, { partition: "train" })).toHaveLength(2);
    expect(selectCases(cases, { caseNames: ["rub", "int"] })).toHaveLength(2);
    expect(selectCases(cases, { categories: ["outra"] })).toEqual([]);
    expect(listPendingCases(cases)).toHaveLength(2);
  });
});
