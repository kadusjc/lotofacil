import { syntheticDraws } from '../test-utils/fixtures';
import { cooccurrenceMatrix, gameProfile, normalCdf, numberStats, percentile, repeatsFromPrevious, uniformityTest } from './statistics';

describe('statistics', () => {
  it('gameProfile', () => {
    const p = gameProfile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(p).toEqual({ sum: 120, odds: 8, primes: 6, frame: 9, fibonacci: 6, maxRun: 15 });
  });
  it('percentile interpolates', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([], 0.5)).toBe(0);
  });
  it('numberStats frequency and delay', () => {
    const draws = syntheticDraws(3);
    draws[2].numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const stats = numberStats(draws);
    expect(stats.reduce((a, s) => a + s.frequency, 0)).toBe(45);
    expect(stats[0].delay).toBe(0);
    expect(stats.find((s) => s.number === 25)!.delay).toBeGreaterThan(0);
  });
  it('repeatsFromPrevious and cooccurrence', () => {
    const draws = syntheticDraws(10);
    expect(repeatsFromPrevious(draws)).toHaveLength(9);
    const m = cooccurrenceMatrix(draws);
    expect(m[0][1]).toBe(m[1][0]);
    expect(m.reduce((a, row, i) => a + row[i], 0)).toBe(150);
  });
  it('uniform synthetic data passes chi-square', () => {
    expect(uniformityTest(syntheticDraws(2000)).isUniform).toBe(true);
  });
  it('normalCdf', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
  });
});
