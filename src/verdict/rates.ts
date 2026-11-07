import type { BaselineCaseEntry } from "../domain/baseline.js";

export interface PooledRate {
  passes: number;
  samples: number;
  rate: number;
}

export function pooledRate(entries: readonly BaselineCaseEntry[]): PooledRate {
  const passes = entries.reduce((total, entry) => total + entry.passes, 0);
  const samples = entries.reduce((total, entry) => total + entry.samples, 0);
  return { passes, samples, rate: samples === 0 ? 0 : passes / samples };
}

export function entryPasses(entry: BaselineCaseEntry): boolean {
  return entry.samples > 0 && entry.passes / entry.samples >= 0.5;
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1).replace(".", ",")}%`;
}
