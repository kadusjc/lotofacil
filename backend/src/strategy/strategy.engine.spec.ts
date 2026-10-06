import { createRng, isValidGame } from '../common/lottery';
import { syntheticDraws } from '../test-utils/fixtures';
import { computeNumberScores, suggestGames, weightedSample, zScores } from './strategy.engine';

describe('strategy engine', () => {
  const draws = syntheticDraws(400);

  it('zScores have mean 0', () => {
    const z = zScores([1, 2, 3, 4]);
    expect(z.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 10);
    expect(zScores([5, 5])).toEqual([0, 0]);
  });
  it('weightedSample returns distinct indexes and favors heavy weights', () => {
    const rng = createRng(1);
    let heavy = 0;
    for (let i = 0; i < 500; i++) {
      const s = weightedSample([100, 1, 1, 1], 1, rng);
      if (s[0] === 0) heavy++;
    }
    expect(heavy).toBeGreaterThan(450);
    expect(new Set(weightedSample(new Array(25).fill(1), 15, rng)).size).toBe(15);
  });
  it('scores all 25 numbers', () => {
    const { scores, analogs } = computeNumberScores(draws);
    expect(scores).toHaveLength(25);
    expect(analogs.length).toBeGreaterThan(0);
  });
  it('suggests valid, diverse and reproducible games', () => {
    const r1 = suggestGames(draws, { games: 3, seed: 9, candidates: 3000 });
    const r2 = suggestGames(draws, { games: 3, seed: 9, candidates: 3000 });
    expect(r1.games.map((g) => g.numbers)).toEqual(r2.games.map((g) => g.numbers));
    expect(r1.games).toHaveLength(3);
    for (const g of r1.games) expect(isValidGame(g.numbers)).toBe(true);
    const [a, b] = r1.games;
    expect(a.numbers.filter((n) => b.numbers.includes(n)).length).toBeLessThanOrEqual(11);
  });
  it('respects profile bounds for 15-number games', () => {
    const r = suggestGames(draws, { candidates: 2000, seed: 3 });
    const g = r.games[0];
    expect(g.profile.sum).toBeGreaterThanOrEqual(r.profileBounds.sum[0]);
    expect(g.profile.sum).toBeLessThanOrEqual(r.profileBounds.sum[1]);
  });
  it('always returns the requested games even when few candidates fit the profile', () => {
    const r = suggestGames(draws, { candidates: 5, games: 5, seed: 9 });
    expect(r.games).toHaveLength(5);
  });
  it('supports bigger bets', () => {
    const r = suggestGames(draws, { betSize: 18, candidates: 1000 });
    expect(isValidGame(r.games[0].numbers, 18)).toBe(true);
  });
  it('validates input', () => {
    expect(() => suggestGames(draws.slice(0, 10))).toThrow(/insuficiente/);
    expect(() => suggestGames(draws, { betSize: 14 })).toThrow(RangeError);
  });
});
