import { createRng, DIADESORTE, isValidGame, LOTOFACIL as G, MEGASENA, QUINA } from '../common/lottery';
import { syntheticDraws } from '../test-utils/fixtures';
import { computeNumberScores, selectSpread, suggestGames, weightedSample, zScores } from './strategy.engine';

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
    const { scores, analogs } = computeNumberScores(G, draws);
    expect(scores).toHaveLength(25);
    expect(analogs.length).toBeGreaterThan(0);
  });
  it('suggests valid, diverse and reproducible games', () => {
    const r1 = suggestGames(G, draws, { games: 3, seed: 9, candidates: 3000 });
    const r2 = suggestGames(G, draws, { games: 3, seed: 9, candidates: 3000 });
    expect(r1.games.map((g) => g.numbers)).toEqual(r2.games.map((g) => g.numbers));
    expect(r1.games).toHaveLength(3);
    for (const g of r1.games) expect(isValidGame(G, g.numbers)).toBe(true);
    const [a, b] = r1.games;
    expect(a.numbers.filter((n) => b.numbers.includes(n)).length).toBeLessThanOrEqual(11);
  });
  it('spreads multiple games: lower overlap than random pairs (9 on average)', () => {
    const { games } = suggestGames(G, draws, { games: 16, seed: 4, candidates: 20000 });
    let sum = 0;
    let pairs = 0;
    for (let i = 0; i < games.length; i++) {
      for (let j = i + 1; j < games.length; j++) {
        const ov = games[i].numbers.filter((n) => games[j].numbers.includes(n)).length;
        expect(ov).toBeLessThanOrEqual(11);
        sum += ov;
        pairs++;
      }
    }
    expect(sum / pairs).toBeLessThan(9);
  });
  it('selectSpread picks the least overlapping candidate next, score only breaks ties', () => {
    const game = (numbers: number[], score: number) => ({ numbers, score, cohesion: 0, profile: {} as never, repeatsFromLast: 0 });
    const first = game([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 3);
    const similar = game([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16], 2);
    const spread = game([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], 1);
    expect(selectSpread([first, similar, spread], 2)).toEqual([first, spread]);
  });
  it('respects profile bounds for 15-number games', () => {
    const r = suggestGames(G, draws, { candidates: 2000, seed: 3 });
    const g = r.games[0];
    expect(g.profile.sum).toBeGreaterThanOrEqual(r.profileBounds.sum[0]);
    expect(g.profile.sum).toBeLessThanOrEqual(r.profileBounds.sum[1]);
  });
  it('always returns the requested games even when few candidates fit the profile', () => {
    const r = suggestGames(G, draws, { candidates: 5, games: 5, seed: 9 });
    expect(r.games).toHaveLength(5);
  });
  it('supports bigger bets', () => {
    const r = suggestGames(G, draws, { betSize: 18, candidates: 1000 });
    expect(isValidGame(G, r.games[0].numbers, 18)).toBe(true);
  });
  it('validates input', () => {
    expect(() => suggestGames(G, draws.slice(0, 10))).toThrow(/insuficiente/);
    expect(() => suggestGames(G, draws, { betSize: 14 })).toThrow(RangeError);
  });
  it.each([MEGASENA, QUINA, DIADESORTE])('$name: jogos válidos e espalhados', (game) => {
    const draws = syntheticDraws(300, 5, game);
    const r = suggestGames(game, draws, { games: 10, candidates: 4000, seed: 1 });
    expect(r.games).toHaveLength(10);
    for (const g of r.games) expect(isValidGame(game, g.numbers)).toBe(true);
    expect(r.numberScores).toHaveLength(game.totalNumbers);
    // Dois jogos aleatórios dividem d²/N dezenas em média; espalhados, no máximo 1–2.
    for (let i = 1; i < r.games.length; i++) {
      expect(r.games[i].numbers.filter((n) => r.games[0].numbers.includes(n)).length).toBeLessThanOrEqual(game.drawn === 7 ? 3 : 2);
    }
    expect(() => suggestGames(game, draws, { betSize: game.maxBet + 1 })).toThrow(RangeError);
  });
});
