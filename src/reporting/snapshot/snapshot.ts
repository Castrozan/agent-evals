import type { ReportDocument } from "../document/reportDocument.js";

export interface SnapshotEvent {
  schemaVersion: 1;
  project: string;
  measuredAt: string;
  commit?: string;
  variant?: string;
  status: ReportDocument["header"]["status"];
  rate: { value: number; lower: number; upper: number; passes: number; samples: number } | null;
  previousRate: number | null;
  categories: { name: string; rate: number | null; samples: number }[];
  failures: number;
  flaky: number;
  uncovered: number;
  coverage: ReportDocument["header"]["coverage"];
  calibrationKappa: number | null;
  isolated: boolean;
  partial: boolean;
  instrument: ReportDocument["header"]["instrument"];
}

export function buildSnapshotEvent(document: ReportDocument): SnapshotEvent {
  const { header } = document;
  return {
    schemaVersion: 1,
    project: header.project,
    measuredAt: header.generatedAt,
    commit: header.commit,
    variant: header.variant,
    status: header.status,
    rate: header.rate,
    previousRate: header.previousRate,
    categories: document.categories.map(({ name, rate, samples }) => ({ name, rate, samples })),
    failures: document.failures.length,
    flaky: document.flaky.length,
    uncovered: document.uncovered.length,
    coverage: header.coverage,
    calibrationKappa: header.calibration.status === "never" ? null : header.calibration.kappa,
    isolated: header.isolation.isolated,
    partial: header.measured.partial,
    instrument: header.instrument,
  };
}

export async function publishSnapshot(
  url: string,
  event: SnapshotEvent,
  fetchImplementation: typeof fetch = fetch,
): Promise<void> {
  let response: Response;
  try {
    response = await fetchImplementation(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch (error) {
    throw new Error(
      `Falha ao enviar o snapshot para ${url}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(`O endpoint do snapshot recusou o envio (HTTP ${response.status}) em ${url}.`);
  }
}
