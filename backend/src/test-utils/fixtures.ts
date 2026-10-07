import { createRng, Draw, LOTOFACIL, LotteryGame, sortAsc } from '../common/lottery';
import { weightedSample } from '../strategy/strategy.engine';

/** Gera histórico sintético uniforme e reprodutível. */
export function syntheticDraws(count: number, seed = 42, game: LotteryGame = LOTOFACIL): Draw[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const numbers = sortAsc(weightedSample(new Array(game.totalNumbers).fill(1), game.drawn, rng).map((x) => x + 1));
    return {
      concurso: i + 1,
      date: '2020-01-01',
      numbers,
      drawOrder: numbers,
      prizes: game === LOTOFACIL ? LOTOFACIL_PRIZES : genericPrizes(game),
    };
  });
}

const LOTOFACIL_PRIZES = [
  { hits: 15, winners: 1, prize: 1_500_000 },
  { hits: 14, winners: 200, prize: 1500 },
  { hits: 13, winners: 8000, prize: 35 },
  { hits: 12, winners: 90000, prize: 14 },
  { hits: 11, winners: 900000, prize: 7 },
];

/** Prêmios ilustrativos: o máximo paga 1,5 mi e cada faixa abaixo ~1/20 da anterior. */
function genericPrizes(game: LotteryGame) {
  return [...game.prizeHits].reverse().map((hits, i) => ({ hits, winners: 10 ** i, prize: Math.round(1_500_000 / 20 ** i) }));
}
