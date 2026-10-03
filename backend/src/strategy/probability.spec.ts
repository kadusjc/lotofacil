import { betProbability, hitProbability, probabilityTable } from './probability';
import { estimateMultipleGames, jointAtLeast, multipleGamesAtLeast14, planBudget } from './bet-planner';

describe('probability', () => {
  it('15-number bet: 14+ is 151 in 3,268,760', () => {
    const p = betProbability(15, 3.5);
    expect(p.atLeast14).toBeCloseTo(151 / 3_268_760, 12);
    expect(p.jackpotOneIn).toBe(3_268_760);
    expect(p.cost).toBe(3.5);
  });
  it('hit distribution sums to 1', () => {
    for (const size of [15, 18, 20]) {
      let total = 0;
      for (let h = 0; h <= 15; h++) total += hitProbability(size, h);
      expect(total).toBeCloseTo(1, 10);
    }
  });
  it('costs follow C(n,15) * price', () => {
    expect(probabilityTable(3.5).map((r) => r.cost)).toEqual([3.5, 56, 476, 2856, 13566, 54264]);
  });
  it('rejects invalid sizes', () => expect(() => betProbability(21, 3.5)).toThrow(RangeError));
});

describe('bet planner', () => {
  it('two games can only both hit 14+ with overlap >= 13', () => {
    expect(jointAtLeast(12)).toBe(0);
    expect(jointAtLeast(13)).toBeGreaterThan(0);
    expect(jointAtLeast(15)).toBeCloseTo(151 / 3_268_760, 12);
  });
  it('disjoint-ish games add up exactly', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const b = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    const p = multipleGamesAtLeast14([a, b]);
    expect(p.lower).toBeCloseTo(p.upper, 15);
    expect(p.upper).toBeCloseTo((2 * 151) / 3_268_760, 12);
  });
  it('identical games give no extra chance (lower bound)', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    expect(multipleGamesAtLeast14([a, a]).lower).toBeCloseTo(151 / 3_268_760, 12);
  });
  it('recommends multiple spread games over one 16-number bet for R$56', () => {
    const plan = planBudget(56, 3.5);
    expect(plan.plans.map((p) => p.kind)).toEqual(['single-bet', 'single-bet', 'multiple-games']);
    expect(plan.recommended?.kind).toBe('multiple-games');
    expect(estimateMultipleGames(16).estimate).toBeGreaterThan(betProbability(16, 3.5).atLeast14);
  });
  it('handles budget below one ticket', () => {
    const plan = planBudget(2, 3.5);
    expect(plan.recommended).toBeNull();
    expect(plan.rationale).toMatch(/insuficiente/);
  });
});
