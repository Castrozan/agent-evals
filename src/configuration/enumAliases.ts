import { ConfigurationError, type EnumAliases } from "./aliasNormalization.js";

export const levelAliases: EnumAliases = {
  unidade: "unit",
  unit: "unit",
  integracao: "integration",
  integration: "integration",
  "ponta-a-ponta": "end-to-end",
  "end-to-end": "end-to-end",
};

export const typeAliases: EnumAliases = {
  instrucao: "instruction",
  instruction: "instruction",
  cli: "cli",
  mcp: "mcp",
};

export const partitionAliases: EnumAliases = {
  treino: "train",
  train: "train",
  reservado: "held-out",
  "held-out": "held-out",
};

export type Partition = "train" | "held-out";

export function normalizePartition(value: string): Partition {
  const canonical = partitionAliases[value];
  if (canonical === undefined) {
    throw new ConfigurationError(
      `partição inválida "${value}"; esperado um de: ${Object.keys(partitionAliases).join(", ")}`,
    );
  }
  return canonical as Partition;
}
