export interface ProportionEstimate {
  successes: number;
  trials: number;
  rate: number;
  lower: number;
  upper: number;
}

const NINETY_FIVE_PERCENT_Z = 1.959963984540054;

export function wilsonInterval(successes: number, trials: number, z = NINETY_FIVE_PERCENT_Z): ProportionEstimate {
  if (trials === 0) return { successes, trials, rate: 0, lower: 0, upper: 0 };
  const rate = successes / trials;
  const zSquared = z * z;
  const denominator = 1 + zSquared / trials;
  const center = (rate + zSquared / (2 * trials)) / denominator;
  const margin = (z * Math.sqrt((rate * (1 - rate)) / trials + zSquared / (4 * trials * trials))) / denominator;
  return { successes, trials, rate, lower: Math.max(0, center - margin), upper: Math.min(1, center + margin) };
}

export function passAtK(samples: number, passes: number, k: number): number {
  if (k <= 0 || samples === 0) return 0;
  if (samples - passes < k) return 1;
  let probabilityAllFail = 1;
  for (let index = samples - passes + 1; index <= samples; index += 1) probabilityAllFail *= 1 - k / index;
  return 1 - probabilityAllFail;
}

export function isFlaky(outcomes: readonly boolean[]): boolean {
  return outcomes.includes(true) && outcomes.includes(false);
}

export function noiseFloor(caseCount: number, repetitions: number): number {
  if (caseCount <= 0 || repetitions <= 0) return 1;
  return 1 / Math.sqrt(caseCount * repetitions);
}

export function headroomExceedsNoise(rate: number, caseCount: number, repetitions: number): boolean {
  return 1 - rate > noiseFloor(caseCount, repetitions);
}
