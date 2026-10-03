export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Executa `fn` com até `attempts` tentativas e backoff exponencial. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 4, baseDelayMs = 500 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastError;
}

/** Mapeia itens com no máximo `concurrency` promessas simultâneas, preservando a ordem. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
