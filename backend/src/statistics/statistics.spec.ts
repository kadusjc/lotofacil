import { LOTOFACIL as G } from '../common/lottery';
import { syntheticDraws } from '../test-utils/fixtures';
import { cooccurrenceMatrix, gameProfile, normalCdf, numberStats, percentile, repeatsFromPrevious, uniformityTest } from './statistics';

describe('statistics', () => {
  it('gameProfile', () => {
    const p = gameProfile(G, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    expect(p).toEqual({ sum: 120, odds: 8, primes: 6, frame: 9, fibonacci: 6, maxRun: 15 });
  });
  it('percentile interpolates', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(percentile([], 0.5)).toBe(0);
  });
  it('numberStats frequency and delay', () => {
    const draws = syntheticDraws(3);
    draws[2].numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const stats = numberStats(G, draws);
    expect(stats.reduce((a, s) => a + s.frequency, 0)).toBe(45);
    expect(stats[0].delay).toBe(0);
    expect(stats.find((s) => s.number === 25)!.delay).toBeGreaterThan(0);
  });
  it('repeatsFromPrevious and cooccurrence', () => {
    const draws = syntheticDraws(10);
    expect(repeatsFromPrevious(draws)).toHaveLength(9);
    const m = cooccurrenceMatrix(G, draws);
    expect(m[0][1]).toBe(m[1][0]);
    expect(m.reduce((a, row, i) => a + row[i], 0)).toBe(150);
  });
  it('uniform synthetic data passes chi-square', () => {
    expect(uniformityTest(G, syntheticDraws(2000)).isUniform).toBe(true);
  });
  it('chi-square uses the without-replacement variance (mean ≈ df under H0)', () => {
    const stats = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => uniformityTest(G, syntheticDraws(1000, seed)).chiSquare);
    const mean = stats.reduce((a, b) => a + b, 0) / stats.length;
    // O Pearson ingênuo daria ≈ 0,4·24 ≈ 9,6 e nunca rejeitaria a uniformidade.
    expect(mean).toBeGreaterThan(14);
    expect(mean).toBeLessThan(36);
  });
  it('chi-square detects a biased number', () => {
    const draws = syntheticDraws(2000).map((d) =>
      d.numbers.includes(1) || !d.numbers.includes(2) ? d : { ...d, numbers: d.numbers.map((n) => (n === 2 ? 1 : n)) },
    );
    expect(uniformityTest(G, draws).isUniform).toBe(false);
  });
  it('normalCdf', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
  });
});
