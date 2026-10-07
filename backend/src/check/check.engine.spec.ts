import { LOTOFACIL as G, MEGASENA } from '../common/lottery';
import { syntheticDraws } from '../test-utils/fixtures';
import { checkBet, runCheck, signalTrackRecord, SIGNALS, validateBets } from './check.engine';

describe('check.engine', () => {
  const draws = syntheticDraws(160);
  const last = draws[draws.length - 1];
  const withPrizes = {
    ...last,
    prizes: [11, 12, 13, 14, 15].map((hits, i) => ({ hits, winners: 1, prize: [7, 14, 35, 1800, 2e6][i] })),
  };

  it('counts hits and prize of a 15-number bet', () => {
    const c = checkBet(G, withPrizes, last.numbers, 3.5);
    expect(c).toMatchObject({ hits: 15, prize: 2e6, cost: 3.5 });
    expect(c.hitNumbers).toEqual(last.numbers);
  });

  it('pays every inner combination of a bigger bet', () => {
    const extra = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25].filter(
      (n) => !last.numbers.includes(n),
    );
    const c = checkBet(G, withPrizes, [...last.numbers, extra[0]], 3.5);
    // 16 dezenas com 15 acertos: 1 combinação de 15 + 15 combinações de 14.
    expect(c.prize).toBe(2e6 + 15 * 1800);
    expect(c.cost).toBe(56);
  });

  it('validates bets', () => {
    expect(validateBets(G, [[1, 2, 3]])).toMatch(/Aposta 1/);
    expect(validateBets(G, [last.numbers])).toBeNull();
  });

  it('measures each signal walk-forward over the window', () => {
    const { mean, window } = signalTrackRecord(G, draws, 10);
    expect(window).toBe(10);
    for (const s of SIGNALS) expect(mean[s]).toBeGreaterThanOrEqual(0);
    for (const s of SIGNALS) expect(mean[s]).toBeLessThanOrEqual(15);
  });

  it('runCheck reports totals, misses and signals', () => {
    const r = runCheck(G, draws, {
      bets: [last.numbers.slice(0, 14).concat(25 === last.numbers[14] ? 1 : 25)],
      concurso: last.concurso,
      betPrice: 3.5,
      window: 5,
    });
    expect(r.bets).toHaveLength(1);
    expect(r.signals).toHaveLength(SIGNALS.length);
    expect(r.missedDrawn.length + r.bets[0].hits).toBe(15);
    expect(() =>
      runCheck(G, draws, { bets: [[1]], concurso: last.concurso, betPrice: 3.5 }),
    ).toThrow(RangeError);
  });
  it('rejects contests without enough prior history', () => {
    expect(() =>
      runCheck(G, draws, { bets: [draws[5].numbers], concurso: draws[5].concurso, betPrice: 3.5 }),
    ).toThrow(/insuficiente/);
  });

  it('Mega-Sena: confere jogo de 6 e mede favoritas de 6', () => {
    const mega = syntheticDraws(160, 7, MEGASENA);
    const lastMega = mega[mega.length - 1];
    const r = runCheck(MEGASENA, mega, { bets: [lastMega.numbers], concurso: lastMega.concurso, betPrice: 6, window: 3 });
    expect(r.bets[0]).toMatchObject({ hits: 6, cost: 6, prize: 1_500_000 });
    expect(r.topSize).toBe(6);
    expect(r.randomTopHits).toBeCloseTo(0.6, 10);
    expect(validateBets(MEGASENA, [[1, 2, 3, 4, 5, 61]])).toMatch(/entre 1 e 60/);
  });
});
