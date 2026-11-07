import { itemsShape, keyRule, objectShape, type KeySchema, type ValueShape } from "./aliasNormalization.js";

const fileKeys: KeySchema = {
  path: keyRule("caminho", "path"),
  content: keyRule("conteudo", "content"),
};

const gitRepositoryKeys: KeySchema = {
  directory: keyRule("diretorio", "directory"),
  remote: keyRule("remoto", "remote"),
};

const repositoryKeys: KeySchema = {
  remote: keyRule("remoto", "remote"),
  revision: keyRule("revisao", "revision"),
  branch: keyRule("ramo", "branch"),
  exclude: keyRule("excluir", "exclude"),
};

const layerKeys: KeySchema = {
  from: keyRule("de", "from"),
  at: keyRule("em", "at"),
  git: keyRule("git", "git", objectShape(gitRepositoryKeys)),
  repository: keyRule("repositorio", "repository", objectShape(repositoryKeys)),
};

const pluginKeys: KeySchema = {
  name: keyRule("nome", "name"),
  copy: keyRule("copia", "copy"),
  files: keyRule("arquivos", "files", itemsShape(objectShape(fileKeys))),
  repository: keyRule("repositorio", "repository", objectShape(repositoryKeys)),
  path: keyRule("caminho", "path"),
};

export const pluginsRule = keyRule("plugin", "plugins", itemsShape(objectShape(pluginKeys)));

export const environmentKeys: KeySchema = {
  git: keyRule("git", "git", itemsShape(objectShape(gitRepositoryKeys))),
  instructions: keyRule("instrucoes", "instructions"),
  files: keyRule("arquivos", "files", itemsShape(objectShape(fileKeys))),
  workspace: keyRule("workspace", "workspace"),
  sessionIn: keyRule("sessao_em", "session_in"),
  layers: keyRule("camadas", "layers", itemsShape(objectShape(layerKeys))),
  adjustments: keyRule("ajustes", "adjustments"),
  removals: keyRule("remocoes", "removals"),
  plugins: pluginsRule,
};

export const environmentShape: ValueShape = objectShape(environmentKeys);
