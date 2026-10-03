import { binomial, DRAWN_PER_CONTEST, MAX_BET_SIZE, MIN_BET_SIZE, TOTAL_NUMBERS } from '../common/lottery';

export interface BetProbability {
  betSize: number;
  /** Quantidade de jogos simples de 15 dezenas contidos na aposta. */
  combinations: number;
  cost: number;
  /** Probabilidade de a aposta conter exatamente k dezenas sorteadas (k = 11..15). */
  hitProbabilities: Record<number, number>;
  /** P(>= 14 acertos) e "1 em X". */
  atLeast14: number;
  atLeast14OneIn: number;
  jackpot: number;
  jackpotOneIn: number;
}

const TOTAL_COMBINATIONS = binomial(TOTAL_NUMBERS, DRAWN_PER_CONTEST); // 3.268.760

/** Distribuição hipergeométrica: a aposta tem `betSize` dezenas, sorteiam-se 15 de 25. */
export function hitProbability(betSize: number, hits: number): number {
  return (
    (binomial(betSize, hits) * binomial(TOTAL_NUMBERS - betSize, DRAWN_PER_CONTEST - hits)) /
    TOTAL_COMBINATIONS
  );
}

export function betProbability(betSize: number, betPrice: number): BetProbability {
  if (betSize < MIN_BET_SIZE || betSize > MAX_BET_SIZE) {
    throw new RangeError(`betSize deve estar entre ${MIN_BET_SIZE} e ${MAX_BET_SIZE}`);
  }
  const hitProbabilities: Record<number, number> = {};
  for (let k = 11; k <= 15; k++) hitProbabilities[k] = hitProbability(betSize, k);
  const atLeast14 = hitProbabilities[14] + hitProbabilities[15];
  const combinations = binomial(betSize, DRAWN_PER_CONTEST);
  return {
    betSize,
    combinations,
    cost: Number((combinations * betPrice).toFixed(2)),
    hitProbabilities,
    atLeast14,
    atLeast14OneIn: Math.round(1 / atLeast14),
    jackpot: hitProbabilities[15],
    jackpotOneIn: Math.round(1 / hitProbabilities[15]),
  };
}

export function probabilityTable(betPrice: number): BetProbability[] {
  const rows: BetProbability[] = [];
  for (let size = MIN_BET_SIZE; size <= MAX_BET_SIZE; size++) rows.push(betProbability(size, betPrice));
  return rows;
}

export { TOTAL_COMBINATIONS };
