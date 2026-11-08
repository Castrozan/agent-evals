import { caseKey } from "../../../domain/cases.js";
import type { SampleResult } from "../../../domain/results.js";
import type { ModelSampleRequest } from "../run/modelCaseExecutor.js";

interface ResultRow {
  vars?: { jobIndex?: number | string };
  response?: { metadata?: { sample?: SampleResult } };
  error?: string;
}

export function readSamples(
  resultsContent: string | undefined,
  requests: readonly ModelSampleRequest[],
  recoveredSample: (index: number) => SampleResult | undefined = () => undefined,
): (SampleResult | undefined)[] {
  const parsed = (resultsContent === undefined ? {} : JSON.parse(resultsContent)) as {
    results?: { results?: ResultRow[] };
  };
  const samples: (SampleResult | undefined)[] = new Array<SampleResult | undefined>(requests.length).fill(undefined);
  for (const row of parsed.results?.results ?? []) {
    const index = Number(row.vars?.jobIndex);
    const request = requests[index];
    if (request === undefined) continue;
    const sample = row.response?.metadata?.sample;
    if (sample !== undefined) {
      samples[index] = sample;
      continue;
    }
    if (row.error !== undefined) throw new Error(`Falha no promptfoo em ${caseKey(request.evalCase)}: ${row.error}`);
  }
  return samples.map((sample, index) => sample ?? recoveredSample(index));
}
