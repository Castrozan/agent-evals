export { ConfigurationError, normalizeValue } from "./aliasNormalization.js";
export type { KeySchema, ValueShape } from "./aliasNormalization.js";
export { normalizePartition, levelAliases, typeAliases, partitionAliases } from "./enumAliases.js";
export type { Partition } from "./enumAliases.js";
export { loadProjectConfig } from "./loadProjectConfig.js";
export { findRepositoryRoot, CONFIG_RELATIVE_PATH } from "./repositoryRoot.js";
export { ignoredGlobs, ALWAYS_IGNORED_GLOBS } from "./ignoredPaths.js";
