import { DIADESORTE, LOTOFACIL as G, MEGASENA, QUINA } from '../common/lottery';
import { betProbability, hitProbability, probabilityTable } from './probability';
import { estimateMultipleGames, planOdds, jointAtLeast, multipleGamesAtLeast, planBudget } from './bet-planner';

describe('probability', () => {
  it('15-number bet: 14+ is 151 in 3,268,760', () => {
    const p = betProbability(G, 15, 3.5);
    expect(p.atLeastNear).toBeCloseTo(151 / 3_268_760, 12);
    expect(p.jackpotOneIn).toBe(3_268_760);
    expect(p.cost).toBe(3.5);
  });
  it('hit distribution sums to 1', () => {
    for (const size of [15, 18, 20]) {
      let total = 0;
      for (let h = 0; h <= 15; h++) total += hitProbability(G, size, h);
      expect(total).toBeCloseTo(1, 10);
    }
  });
  it('costs follow C(n,15) * price', () => {
    expect(probabilityTable(G, 3.5).map((r) => r.cost)).toEqual([3.5, 56, 476, 2856, 13566, 54264]);
  });
  it('rejects invalid sizes', () => expect(() => betProbability(G, 21, 3.5)).toThrow(RangeError));
});

describe('bet planner', () => {
  it('two games can only both hit 14+ with overlap >= 13', () => {
    expect(jointAtLeast(G, 12)).toBe(0);
    expect(jointAtLeast(G, 13)).toBeGreaterThan(0);
    expect(jointAtLeast(G, 15)).toBeCloseTo(151 / 3_268_760, 12);
  });
  it('disjoint-ish games add up exactly', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const b = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    const p = multipleGamesAtLeast(G, [a, b]);
    expect(p.lower).toBeCloseTo(p.upper, 15);
    expect(p.upper).toBeCloseTo((2 * 151) / 3_268_760, 12);
  });
  it('identical games give no extra chance (lower bound)', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    expect(multipleGamesAtLeast(G, [a, a]).lower).toBeCloseTo(151 / 3_268_760, 12);
  });
  it('recommends multiple spread games over one 16-number bet for R$56', () => {
    const plan = planBudget(G, 56, 3.5);
    expect(plan.plans.map((p) => p.kind)).toEqual(['single-bet', 'single-bet', 'multiple-games']);
    expect(plan.recommended?.kind).toBe('multiple-games');
    expect(estimateMultipleGames(G, 16).estimate).toBeGreaterThan(betProbability(G, 16, 3.5).atLeastNear);
  });
  it('handles budget below one ticket', () => {
    const plan = planBudget(G, 2, 3.5);
    expect(plan.recommended).toBeNull();
    expect(plan.rationale).toMatch(/insuficiente/);
  });
});

describe('planOdds', () => {
  const tier = (o: { tiers: Array<{ hits: number; probability: number }> }, hits: number) => o.tiers.find((t) => t.hits === hits)!.probability;
  it('single 15-number bet uses exact hypergeometric', () => {
    const o = planOdds(G, [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]], 15);
    expect(tier(o, 14)).toBeCloseTo(151 / 3_268_760, 12);
    expect(tier(o, 11)).toBeCloseTo(0.1062, 3);
  });
  it('multiple games: Monte Carlo 11+ grows with more games and 15 is exact', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
    const b = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    const o = planOdds(G, [a, b], 15, 50_000);
    expect(tier(o, 11)).toBeGreaterThan(0.15);
    expect(tier(o, 11)).toBeLessThan(0.22);
    expect(tier(o, 15)).toBeCloseTo(2 / 3_268_760, 12);
  });
  it('Mega-Sena: 1 jogo de 6 tem sena 1 em 50.063.860 e quina+ exata', () => {
    const o = planOdds(MEGASENA, [[1, 2, 3, 4, 5, 6]], 6);
    expect(tier(o, 6)).toBeCloseTo(1 / 50_063_860, 15);
    expect(tier(o, 5)).toBeCloseTo((6 * 54 + 1) / 50_063_860, 15);
  });
  it('Mega-Sena: jogos sem 4 dezenas em comum somam exatamente na quina+', () => {
    const games = [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12], [1, 2, 3, 13, 14, 15]];
    const o = planOdds(MEGASENA, games, 6);
    expect(tier(o, 5)).toBeCloseTo((3 * 325) / 50_063_860, 15);
  });
});

describe('outros jogos', () => {
  it('Quina: custos e chance de quina', () => {
    expect(betProbability(QUINA, 5, 3).jackpotOneIn).toBe(24_040_016);
    expect(probabilityTable(QUINA, 3).map((r) => r.cost).slice(0, 3)).toEqual([3, 18, 63]);
  });
  it('Dia de Sorte: 7 acertos 1 em 2.629.575 e aposta de 15 custa C(15,7)·2,50', () => {
    expect(betProbability(DIADESORTE, 7, 2.5).jackpotOneIn).toBe(2_629_575);
    expect(betProbability(DIADESORTE, 15, 2.5).cost).toBe(6435 * 2.5);
  });
  it('Mega-Sena: jogos espalhados vencem aposta de 7 dezenas pelo mesmo valor', () => {
    const plan = planBudget(MEGASENA, 42, 6);
    expect(plan.recommended?.kind).toBe('multiple-games');
    expect(plan.recommended?.tickets).toBe(7);
  });
});
