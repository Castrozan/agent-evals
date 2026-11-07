import type { z } from "zod";
import {
  ConfigurationError,
  formatPath,
  translatePath,
  type PathSegment,
  type ValueShape,
} from "./aliasNormalization.js";

function describeIssue(issue: z.core.$ZodIssue, shape: ValueShape | undefined): string {
  const path = issue.path.filter((segment): segment is PathSegment => typeof segment !== "symbol");
  if (issue.code === "unrecognized_keys") {
    const keys = issue.keys.map((key) => formatPath(translatePath(shape, [...path, key])));
    return `chave desconhecida ${keys.map((key) => `"${key}"`).join(", ")}`;
  }
  const label = formatPath(translatePath(shape, path));
  const where = label === "" ? "" : `"${label}": `;
  if (issue.code === "invalid_type") {
    return `${where}tipo inválido, esperado ${issue.expected}`;
  }
  if (issue.code === "custom") return `${where}${issue.message}`;
  return `${where}valor inválido (${issue.message})`;
}

export function toConfigurationError(
  error: z.ZodError,
  shape: ValueShape | undefined,
  file: string,
  prefix: PathSegment[] = [],
): ConfigurationError {
  const lines = error.issues.map((issue) => {
    const shifted = { ...issue, path: [...prefix, ...issue.path] } as z.core.$ZodIssue;
    return `${file}: ${describeIssue(shifted, shape)}`;
  });
  return new ConfigurationError(lines.join("\n"));
}
