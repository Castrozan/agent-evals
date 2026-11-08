export interface SuiteCounts {
  tests?: number;
  failures?: number;
  errors?: number;
  skipped?: number;
  durationSeconds?: number;
}

const TAG = /<(\/?)(testsuites|testsuite)\b((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
const ATTRIBUTE = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

function attributesOf(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of source.matchAll(ATTRIBUTE)) attributes[match[1] ?? ""] = match[2] ?? match[3] ?? "";
  return attributes;
}

function numberOrUndefined(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function countsOf(attributes: Record<string, string>): SuiteCounts {
  return {
    tests: numberOrUndefined(attributes.tests),
    failures: numberOrUndefined(attributes.failures),
    errors: numberOrUndefined(attributes.errors),
    skipped: numberOrUndefined(attributes.skipped),
    durationSeconds: numberOrUndefined(attributes.time),
  };
}

export function addCounts(total: SuiteCounts, next: SuiteCounts): SuiteCounts {
  const sum = (first?: number, second?: number) =>
    first === undefined && second === undefined ? undefined : (first ?? 0) + (second ?? 0);
  return {
    tests: sum(total.tests, next.tests),
    failures: sum(total.failures, next.failures),
    errors: sum(total.errors, next.errors),
    skipped: sum(total.skipped, next.skipped),
    durationSeconds: sum(total.durationSeconds, next.durationSeconds),
  };
}

export function parseJunit(xml: string): SuiteCounts | undefined {
  const stripped = xml.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  const openSuites: string[] = [];
  let rootCounts: SuiteCounts | undefined;
  let summed: SuiteCounts | undefined;
  for (const match of stripped.matchAll(TAG)) {
    const [, closing, name = "", attributeSource = "", selfClosing] = match;
    if (closing) {
      openSuites.pop();
      continue;
    }
    const attributes = attributesOf(attributeSource);
    if (name === "testsuites" && openSuites.length === 0 && attributes.tests !== undefined) {
      rootCounts = countsOf(attributes);
    }
    if (name === "testsuite" && !openSuites.includes("testsuite")) {
      summed = addCounts(summed ?? {}, countsOf(attributes));
    }
    if (!selfClosing) openSuites.push(name);
  }
  return rootCounts ?? summed;
}
