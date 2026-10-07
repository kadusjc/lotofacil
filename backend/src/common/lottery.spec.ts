import { binomial, countHits, createRng, isValidGame, LOTOFACIL } from './lottery';
import { mapWithConcurrency, withRetry } from './concurrency';

describe('lottery utils', () => {
  it('binomial', () => {
    expect(binomial(25, 15)).toBe(3_268_760);
    expect(binomial(20, 15)).toBe(15_504);
    expect(binomial(5, 7)).toBe(0);
  });
  it('isValidGame', () => {
    expect(isValidGame(LOTOFACIL, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toBe(true);
    expect(isValidGame(LOTOFACIL, [1, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toBe(false);
    expect(isValidGame(LOTOFACIL, [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])).toBe(false);
    expect(isValidGame(LOTOFACIL, [1, 2, 3])).toBe(false);
  });
  it('countHits', () => expect(countHits([1, 2, 3, 4], [2, 4, 9])).toBe(2));
  it('rng is deterministic and in [0,1)', () => {
    const a = createRng(7);
    const b = createRng(7);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});

describe('concurrency', () => {
  it('withRetry retries then succeeds', async () => {
    let calls = 0;
    const result = await withRetry(async () => {
      if (++calls < 3) throw new Error('fail');
      return 'ok';
    }, { baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(calls).toBe(3);
  });
  it('withRetry gives up', async () => {
    await expect(withRetry(async () => { throw new Error('x'); }, { attempts: 2, baseDelayMs: 1 })).rejects.toThrow('x');
  });
  it('mapWithConcurrency preserves order and limits parallelism', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (x) => {
      peak = Math.max(peak, ++active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return x * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBe(2);
  });
});
