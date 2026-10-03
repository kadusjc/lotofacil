import { createRng, Draw, sortAsc } from '../common/lottery';
import { weightedSample } from '../strategy/strategy.engine';

/** Gera histórico sintético uniforme e reprodutível. */
export function syntheticDraws(count: number, seed = 42): Draw[] {
  const rng = createRng(seed);
  return Array.from({ length: count }, (_, i) => {
    const numbers = sortAsc(weightedSample(new Array(25).fill(1), 15, rng).map((x) => x + 1));
    return {
      concurso: i + 1,
      date: '2020-01-01',
      numbers,
      drawOrder: numbers,
      prizes: [
        { hits: 15, winners: 1, prize: 1_500_000 },
        { hits: 14, winners: 200, prize: 1500 },
        { hits: 13, winners: 8000, prize: 35 },
        { hits: 12, winners: 90000, prize: 14 },
        { hits: 11, winners: 900000, prize: 7 },
      ],
    };
  });
}
