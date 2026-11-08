import {
  enumShape,
  itemsShape,
  keyRule,
  objectShape,
  type KeySchema,
  type ValueShape,
} from "../configuration/aliasNormalization.js";
import { levelAliases, typeAliases } from "../configuration/enumAliases.js";
import { environmentShape } from "../configuration/environmentKeys.js";

const assertionKeys: KeySchema = {
  judge: keyRule("juiz", "judge"),
  equals: keyRule("igual", "equals"),
  contains: keyRule("contem", "contains"),
  notContains: keyRule("nao_contem", "not_contains"),
  regex: keyRule("regex", "regex"),
  notRegex: keyRule("nao_regex", "not_regex"),
  skillsUsed: keyRule("skills_usadas", "skills_used"),
  skillsForbidden: keyRule("skills_proibidas", "skills_forbidden"),
  toolsUsed: keyRule("ferramentas_usadas", "tools_used"),
  toolsForbidden: keyRule("ferramentas_proibidas", "tools_forbidden"),
  commandsRun: keyRule("comandos_executados", "commands_run"),
  commandsRunForbidden: keyRule("comandos_executados_proibidos", "commands_run_forbidden"),
  generatedFiles: keyRule("arquivo_gerado", "generated_files"),
  commands: keyRule(
    "comandos",
    "commands",
    itemsShape(
      objectShape({
        run: keyRule("executa", "run"),
        regex: keyRule("regex", "regex"),
        notRegex: keyRule("nao_regex", "not_regex"),
      }),
    ),
  ),
  judgeOnCommand: keyRule(
    "juiz_sobre_comando",
    "judge_on_command",
    itemsShape(
      objectShape({
        run: keyRule("executa", "run"),
        reference: keyRule("referencia", "reference"),
        rubric: keyRule("rubrica", "rubric"),
      }),
    ),
  ),
};

const serverKeys: KeySchema = {
  name: keyRule("nome", "name"),
  command: keyRule("comando", "command"),
  environment: keyRule("ambiente", "environment"),
};

const contractToolKeys: KeySchema = {
  name: keyRule("nome", "name"),
  required: keyRule("obrigatorios", "required"),
};

const callKeys: KeySchema = {
  tool: keyRule("ferramenta", "tool"),
  arguments: keyRule("argumentos", "arguments"),
  contains: keyRule("contem", "contains"),
};

export const caseKeys: KeySchema = {
  name: keyRule("nome", "name"),
  level: keyRule("nivel", "level", enumShape(levelAliases)),
  type: keyRule("tipo", "type", enumShape(typeAliases)),
  repetitions: keyRule("execucoes", "repetitions"),
  pending: keyRule("pendente", "pending"),
  heldOut: keyRule("reservado", "held_out"),
  timeoutSeconds: keyRule("tempo_limite_segundos", "timeout_seconds"),
  instruction: keyRule("instrucao", "instruction"),
  extraInstructions: keyRule("instrucoes_extras", "extra_instructions"),
  systemPrompt: keyRule("system_prompt", "system_prompt"),
  prompt: keyRule("pergunta", "prompt"),
  model: keyRule("modelo", "model"),
  models: keyRule("modelos", "models"),
  effort: keyRule("esforco", "effort"),
  writes: keyRule("escreve", "writes"),
  environment: keyRule("ambiente", "environment", environmentShape),
  assertions: keyRule("assercoes", "assertions", objectShape(assertionKeys)),
  command: keyRule("comando", "command"),
  stdin: keyRule("entrada", "stdin"),
  exitCode: keyRule("codigo_de_saida", "exit_code"),
  server: keyRule("servidor", "server", objectShape(serverKeys)),
  contract: keyRule("contrato", "contract", itemsShape(objectShape(contractToolKeys))),
  strict: keyRule("estrito", "strict"),
  calls: keyRule("chamadas", "calls", itemsShape(objectShape(callKeys))),
};

export const caseFileKeys: KeySchema = {
  category: keyRule("categoria", "category"),
  cases: keyRule("casos", "cases", itemsShape(objectShape(caseKeys))),
};

export const caseFileShape: ValueShape = objectShape(caseFileKeys);
