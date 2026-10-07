import { LOTOFACIL as G } from '../common/lottery';
import { syntheticDraws } from '../test-utils/fixtures';
import { averagePrizes, planReturns } from './returns';

describe('returns', () => {
  const prizes = averagePrizes(G, syntheticDraws(60));
  it('averages real prize tiers', () => {
    expect(prizes.map((p) => p.prize)).toEqual([7, 14, 35, 1500, 1_500_000]);
  });
  it('15-number bet: expected value and payouts', () => {
    const r = planReturns(G, 15, 1, 3.5, prizes, 50);
    expect(r.tiers.map((t) => t.payout)).toEqual([7, 14, 35, 1500, 1_500_000]);
    expect(r.maxPayout).toBe(1_500_000);
    expect(r.expectedPrize).toBeGreaterThan(0);
    expect(r.expectedNet).toBeCloseTo(r.expectedPrize - 3.5);
  });
  it('16-number bet with 15 hits pays the jackpot plus 15 prizes of 14', () => {
    const r = planReturns(G, 16, 1, 56, prizes, 50);
    expect(r.maxPayout).toBe(1_500_000 + 15 * 1500);
  });
  it('multiple games: expected prize scales linearly', () => {
    const one = planReturns(G, 15, 1, 3.5, prizes, 50);
    const many = planReturns(G, 15, 16, 56, prizes, 50);
    expect(many.expectedPrize).toBeCloseTo(16 * one.expectedPrize, 8);
    expect(many.expectedReturnPct).toBeCloseTo(one.expectedReturnPct, 8);
    expect(many.probabilityScope).toBe('per-ticket');
  });
});
