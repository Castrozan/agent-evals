export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export type PathSegment = string | number;

export type EnumAliases = Record<string, string>;

export type ValueShape =
  | { kind: "object"; keys: KeySchema }
  | { kind: "items"; item: ValueShape }
  | { kind: "mapOf"; value: ValueShape }
  | { kind: "enum"; aliases: EnumAliases };

export interface KeyRule {
  portuguese: string;
  english: string;
  shape?: ValueShape;
}

export type KeySchema = Record<string, KeyRule>;

export function keyRule(portuguese: string, english: string, shape?: ValueShape): KeyRule {
  return { portuguese, english, shape };
}

export function objectShape(keys: KeySchema): ValueShape {
  return { kind: "object", keys };
}

export function itemsShape(item: ValueShape): ValueShape {
  return { kind: "items", item };
}

export function mapOfShape(value: ValueShape): ValueShape {
  return { kind: "mapOf", value };
}

export function enumShape(aliases: EnumAliases): ValueShape {
  return { kind: "enum", aliases };
}

export function formatPath(segments: PathSegment[]): string {
  return segments.reduce<string>((label, segment) => {
    if (typeof segment === "number") return `${label}[${segment}]`;
    return label === "" ? segment : `${label}.${segment}`;
  }, "");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findRule(keys: KeySchema, spelling: string): [string, KeyRule] | undefined {
  return Object.entries(keys).find(([, rule]) => rule.portuguese === spelling || rule.english === spelling);
}

function normalizeObject(
  value: Record<string, unknown>,
  keys: KeySchema,
  path: PathSegment[],
  file: string,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const spellings: Record<string, string> = {};
  for (const [spelling, child] of Object.entries(value)) {
    const found = findRule(keys, spelling);
    if (!found) {
      throw new ConfigurationError(`${file}: chave desconhecida "${formatPath([...path, spelling])}"`);
    }
    const [canonical, rule] = found;
    const previous = spellings[canonical];
    if (previous !== undefined) {
      throw new ConfigurationError(
        `${file}: chave duplicada "${formatPath([...path, spelling])}": "${previous}" e "${spelling}" declaram o mesmo campo`,
      );
    }
    spellings[canonical] = spelling;
    normalized[canonical] = normalizeValue(child, rule.shape, [...path, spelling], file);
  }
  return normalized;
}

export function normalizeValue(
  value: unknown,
  shape: ValueShape | undefined,
  path: PathSegment[],
  file: string,
): unknown {
  if (!shape) return value;
  if (shape.kind === "enum") {
    if (typeof value !== "string") return value;
    const canonical = shape.aliases[value];
    if (canonical !== undefined) return canonical;
    throw new ConfigurationError(
      `${file}: valor inválido "${value}" em "${formatPath(path)}"; esperado um de: ${Object.keys(shape.aliases).join(", ")}`,
    );
  }
  if (shape.kind === "object") {
    return isPlainObject(value) ? normalizeObject(value, shape.keys, path, file) : value;
  }
  if (shape.kind === "mapOf") {
    if (!isPlainObject(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([name, child]) => [name, normalizeValue(child, shape.value, [...path, name], file)]),
    );
  }
  if (Array.isArray(value)) {
    return value.map((child, index) => normalizeValue(child, shape.item, [...path, index], file));
  }
  return isPlainObject(value) ? normalizeValue(value, shape.item, path, file) : value;
}

export function translatePath(shape: ValueShape | undefined, path: PathSegment[]): PathSegment[] {
  const translated: PathSegment[] = [];
  let current = shape;
  for (const segment of path) {
    if (current?.kind === "items") {
      const isIndex = typeof segment === "number";
      current = current.item;
      if (isIndex) {
        translated.push(segment);
        continue;
      }
    }
    if (current?.kind === "mapOf") {
      translated.push(segment);
      current = current.value;
    } else if (current?.kind === "object" && typeof segment === "string") {
      const rule = current.keys[segment];
      translated.push(rule ? rule.portuguese : segment);
      current = rule?.shape;
    } else {
      translated.push(segment);
      current = undefined;
    }
  }
  return translated;
}
