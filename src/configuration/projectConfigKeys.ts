import { keyRule, mapOfShape, objectShape, type KeySchema, type ValueShape } from "./aliasNormalization.js";
import { pluginsRule } from "./environmentKeys.js";

const kindKeys: KeySchema = {
  skill: keyRule("skill", "skill"),
  package: keyRule("pacote", "package"),
};

const repetitionKeys: KeySchema = {
  unit: keyRule("unidade", "unit"),
  integration: keyRule("integracao", "integration"),
  "end-to-end": keyRule("ponta-a-ponta", "end-to-end"),
};

const variantKeys: KeySchema = {
  plugins: keyRule("plugins", "plugins", pluginsRule.shape),
  environment: keyRule("ambiente", "environment"),
};

export const projectConfigKeys: KeySchema = {
  project: keyRule("projeto", "project"),
  casePatterns: keyRule("casos", "cases", objectShape(kindKeys)),
  baseline: keyRule("baseline", "baseline"),
  report: keyRule("relatorio", "report"),
  pages: keyRule("paginas", "pages"),
  pagesUrl: keyRule("paginas_url", "pages_url"),
  defaultModel: keyRule("modelo_padrao", "default_model"),
  defaultEffort: keyRule("esforco_padrao", "default_effort"),
  subject: keyRule(
    "sujeito",
    "subject",
    objectShape({
      client: keyRule("cliente", "client"),
      environment: keyRule("ambiente", "environment"),
      removedEnvironment: keyRule("ambiente_removido", "removed_environment"),
    }),
  ),
  judge: keyRule(
    "juiz",
    "judge",
    objectShape({
      model: keyRule("modelo", "model"),
      client: keyRule("cliente", "client"),
      effort: keyRule("esforco", "effort"),
      calibration: keyRule("calibracao", "calibration"),
    }),
  ),
  discovery: keyRule(
    "descoberta",
    "discovery",
    objectShape({
      instructions: keyRule("instrucoes", "instructions"),
      ignore: keyRule("ignorar", "ignore"),
    }),
  ),
  validateInstructionFormat: keyRule("validar_formato_instrucoes", "validate_instruction_format"),
  repetitions: keyRule("execucoes", "repetitions", objectShape(repetitionKeys)),
  thresholds: keyRule(
    "limites",
    "thresholds",
    objectShape({
      overallFloor: keyRule("piso_geral", "overall_floor"),
      criticalFloor: keyRule("piso_critico", "critical_floor"),
      maxDrop: keyRule("queda_maxima", "max_drop"),
      validityDays: keyRule("validade_dias", "validity_days"),
      criticalCategories: keyRule("categorias_criticas", "critical_categories"),
      requiredCategories: keyRule("categorias_obrigatorias", "required_categories"),
      minimumRepetitions: keyRule("execucoes_minimas", "minimum_repetitions"),
    }),
  ),
  parallelism: keyRule("paralelismo", "parallelism"),
  timeoutSeconds: keyRule("tempo_limite_segundos", "timeout_seconds"),
  testSuite: keyRule(
    "suite_de_testes",
    "test_suite",
    objectShape({
      command: keyRule("comando", "command"),
      junit: keyRule("junit", "junit"),
      count: keyRule("contagem", "count"),
      label: keyRule("rotulo", "label"),
    }),
  ),
  variants: keyRule("variantes", "variants", mapOfShape(objectShape(variantKeys))),
  snapshot: keyRule("snapshot", "snapshot", objectShape({ url: keyRule("url", "url") })),
};

export const projectConfigShape: ValueShape = objectShape(projectConfigKeys);
