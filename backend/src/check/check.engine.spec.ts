import { syntheticDraws } from '../test-utils/fixtures';
import { DEFAULT_WEIGHTS } from '../strategy/strategy.engine';
import { calibrateWeights, checkBet, learnFromBets, runCheck, SIGNALS, validateBets } from './check.engine';

describe('check.engine', () => {
  const draws = syntheticDraws(160);
  const last = draws[draws.length - 1];
  const withPrizes = {
    ...last,
    prizes: [11, 12, 13, 14, 15].map((hits, i) => ({ hits, winners: 1, prize: [7, 14, 35, 1800, 2e6][i] })),
  };

  it('counts hits and prize of a 15-number bet', () => {
    const c = checkBet(withPrizes, last.numbers, 3.5);
    expect(c).toMatchObject({ hits: 15, prize: 2e6, cost: 3.5 });
    expect(c.hitNumbers).toEqual(last.numbers);
  });

  it('pays every inner combination of a bigger bet', () => {
    const extra = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].filter(
      (n) => !last.numbers.includes(n),
    );
    const c = checkBet(withPrizes, [...last.numbers, extra[0]], 3.5);
    // 16 dezenas com 15 acertos: 1 combinação de 15 + 15 combinações de 14.
    expect(c.prize).toBe(2e6 + 15 * 1800);
    expect(c.cost).toBe(56);
  });

  it('validates bets', () => {
    expect(validateBets([[1, 2, 3]])).toMatch(/Aposta 1/);
    expect(validateBets([last.numbers])).toBeNull();
  });

  it('calibrates weights keeping the total of the signal weights', () => {
    const { weights, window } = calibrateWeights(draws, 10);
    expect(window).toBe(10);
    const sum = (w: typeof DEFAULT_WEIGHTS) => SIGNALS.reduce((a, s) => a + w[s], 0);
    expect(sum(weights)).toBeCloseTo(sum(DEFAULT_WEIGHTS), 3);
    expect(weights.cohesion).toBe(DEFAULT_WEIGHTS.cohesion);
  });

  it('runCheck reports totals, misses and signals', () => {
    const r = runCheck(draws, {
      bets: [last.numbers.slice(0, 14).concat(25 === last.numbers[14] ? 1 : 25)],
      concurso: last.concurso,
      betPrice: 3.5,
      previousWeights: DEFAULT_WEIGHTS,
      window: 5,
    });
    expect(r.bets).toHaveLength(1);
    expect(r.signals).toHaveLength(SIGNALS.length);
    expect(r.missedDrawn.length + r.bets[0].hits).toBe(15);
    expect(() =>
      runCheck(draws, { bets: [[1]], concurso: last.concurso, betPrice: 3.5, previousWeights: DEFAULT_WEIGHTS }),
    ).toThrow(RangeError);
  });
  it('rejects contests without enough prior history', () => {
    expect(() =>
      runCheck(draws, { bets: [draws[5].numbers], concurso: draws[5].concurso, betPrice: 3.5, previousWeights: DEFAULT_WEIGHTS }),
    ).toThrow(/insuficiente/);
  });

  it('learnFromBets favors signals that pointed to the hits', () => {
    const adv = { long: 1, recent: -1, momentum: 0, delay: 0, analog: 0 };
    const w = learnFromBets(DEFAULT_WEIGHTS, DEFAULT_WEIGHTS, adv);
    expect(w.long).toBeGreaterThan(DEFAULT_WEIGHTS.long);
    expect(w.recent).toBeLessThan(DEFAULT_WEIGHTS.recent);
    const sum = (x: typeof w) => SIGNALS.reduce((a, s) => a + x[s], 0);
    expect(sum(w)).toBeCloseTo(sum(DEFAULT_WEIGHTS), 3);
  });
});
