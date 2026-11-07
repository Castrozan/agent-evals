function logFactorial(value: number): number {
  let total = 0;
  for (let index = 2; index <= value; index += 1) total += Math.log(index);
  return total;
}

function binomialProbability(trials: number, successes: number): number {
  return Math.exp(
    logFactorial(trials) - logFactorial(successes) - logFactorial(trials - successes) - trials * Math.LN2,
  );
}

export interface McNemarResult {
  discordantDown: number;
  discordantUp: number;
  pValue: number;
}

export function exactMcNemar(discordantDown: number, discordantUp: number): McNemarResult {
  const discordant = discordantDown + discordantUp;
  if (discordant === 0) return { discordantDown, discordantUp, pValue: 1 };
  const smaller = Math.min(discordantDown, discordantUp);
  let tail = 0;
  for (let successes = 0; successes <= smaller; successes += 1) tail += binomialProbability(discordant, successes);
  return { discordantDown, discordantUp, pValue: Math.min(1, 2 * tail) };
}

export function isSignificantDecline(result: McNemarResult, alpha = 0.05): boolean {
  return result.discordantDown > result.discordantUp && result.pValue < alpha;
}

function rankSum(first: readonly number[], second: readonly number[]): number {
  const pooled = [
    ...first.map((value) => ({ value, fromFirst: true })),
    ...second.map((value) => ({ value, fromFirst: false })),
  ];
  pooled.sort((left, right) => left.value - right.value);
  let firstRankSum = 0;
  let index = 0;
  while (index < pooled.length) {
    let tieEnd = index;
    while (tieEnd + 1 < pooled.length && pooled[tieEnd + 1]!.value === pooled[index]!.value) tieEnd += 1;
    const averageRank = (index + tieEnd) / 2 + 1;
    for (let tied = index; tied <= tieEnd; tied += 1) if (pooled[tied]!.fromFirst) firstRankSum += averageRank;
    index = tieEnd + 1;
  }
  return firstRankSum;
}

function mannWhitneyU(first: readonly number[], second: readonly number[]): number {
  return rankSum(first, second) - (first.length * (first.length + 1)) / 2;
}

const EXACT_PERMUTATION_LIMIT = 20;

function* combinations(size: number, choose: number, start = 0, chosen: number[] = []): Generator<number[]> {
  if (chosen.length === choose) {
    yield chosen;
    return;
  }
  for (let index = start; index <= size - (choose - chosen.length); index += 1) {
    yield* combinations(size, choose, index + 1, [...chosen, index]);
  }
}

function permutationPValue(first: readonly number[], second: readonly number[]): number {
  const pooled = [...first, ...second];
  const expected = (first.length * second.length) / 2;
  const observedDistance = Math.abs(mannWhitneyU(first, second) - expected);
  let extreme = 0;
  let total = 0;
  for (const chosen of combinations(pooled.length, first.length)) {
    const chosenSet = new Set(chosen);
    const permutedFirst = chosen.map((index) => pooled[index]!);
    const permutedSecond = pooled.filter((_, index) => !chosenSet.has(index));
    if (Math.abs(mannWhitneyU(permutedFirst, permutedSecond) - expected) >= observedDistance - 1e-9) extreme += 1;
    total += 1;
  }
  return extreme / total;
}

function standardNormalTail(value: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(value));
  const density = Math.exp((-value * value) / 2) / Math.sqrt(2 * Math.PI);
  const tail =
    density * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return value >= 0 ? tail : 1 - tail;
}

export interface MannWhitneyResult {
  u: number;
  pValue: number;
  exact: boolean;
}

export function mannWhitney(first: readonly number[], second: readonly number[]): MannWhitneyResult {
  if (first.length === 0 || second.length === 0) return { u: 0, pValue: 1, exact: true };
  const u = mannWhitneyU(first, second);
  if (first.length + second.length <= EXACT_PERMUTATION_LIMIT) {
    return { u, pValue: Math.min(1, permutationPValue(first, second)), exact: true };
  }
  const expected = (first.length * second.length) / 2;
  const deviation = Math.sqrt((first.length * second.length * (first.length + second.length + 1)) / 12);
  const z = (Math.abs(u - expected) - 0.5) / deviation;
  return { u, pValue: Math.min(1, 2 * standardNormalTail(z)), exact: false };
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}
