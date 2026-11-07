export async function runWithConcurrency<Item, Result>(
  items: readonly Item[],
  concurrency: number,
  work: (item: Item, index: number) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = new Array<Result>(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]!, index);
    }
  });
  await Promise.all(lanes);
  return results;
}
