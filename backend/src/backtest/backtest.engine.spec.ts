import { LOTOFACIL as G } from '../common/lottery';
import { syntheticDraws } from '../test-utils/fixtures';
import { prizeFor, runBacktest } from './backtest.engine';

describe('backtest', () => {
  const draws = syntheticDraws(250);
  it('prizeFor 15-number bet', () => {
    expect(prizeFor(G, draws[0], 15, 11)).toBe(7);
    expect(prizeFor(G, draws[0], 15, 10)).toBe(0);
  });
  it('prizeFor 16-number bet with 15 hits pays 1x15 + 1x14... ', () => {
    // 16 dezenas, 15 acertos: C(15,15)*C(1,0)=1 jogo de 15 e C(15,14)*C(1,1)=15 jogos de 14
    expect(prizeFor(G, draws[0], 16, 15)).toBe(1_500_000 + 15 * 1500);
  });
  it('walk-forward is consistent with chance on random data', () => {
    const r = runBacktest(G, draws, { testSize: 40, candidates: 300 });
    expect(r.testSize).toBe(40);
    expect(r.rows).toHaveLength(40);
    expect(r.expectedRandomMeanHits).toBe(9);
    expect(r.meanHits).toBeGreaterThan(7);
    expect(r.meanHits).toBeLessThan(11);
    expect(r.hitDistribution.reduce((a, d) => a + d.observed, 0)).toBe(40);
    expect(r.totalCost).toBeCloseTo(40 * 3.5);
  });
  it('budget mode tests the recommended multi-ticket plan', () => {
    const r = runBacktest(G, draws, { testSize: 5, budget: 14, candidates: 400 });
    expect(r.tickets).toBe(4);
    expect(r.rows[0].games).toHaveLength(4);
    expect(r.hitDistribution.reduce((a, d) => a + d.observed, 0)).toBe(20);
    expect(r.totalCost).toBeCloseTo(5 * 4 * 3.5);
    expect(() => runBacktest(G, draws, { testSize: 5, budget: 1 })).toThrow(RangeError);
  });
});
