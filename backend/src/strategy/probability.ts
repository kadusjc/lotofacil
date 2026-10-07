import { binomial, LotteryGame, totalCombinations } from '../common/lottery';

export interface BetProbability {
  betSize: number;
  /** Quantidade de jogos simples contidos na aposta. */
  combinations: number;
  cost: number;
  /** Probabilidade de a aposta conter exatamente k dezenas sorteadas (k = cada faixa premiada). */
  hitProbabilities: Record<number, number>;
  /** P(>= faixa "quase máxima") e "1 em X". */
  atLeastNear: number;
  atLeastNearOneIn: number;
  jackpot: number;
  jackpotOneIn: number;
}

/** Distribuição hipergeométrica: a aposta tem `betSize` dezenas, sorteiam-se `drawn` de `totalNumbers`. */
export function hitProbability(game: LotteryGame, betSize: number, hits: number): number {
  return (
    (binomial(betSize, hits) * binomial(game.totalNumbers - betSize, game.drawn - hits)) / totalCombinations(game)
  );
}

/** P(aposta de `betSize` dezenas conter >= `threshold` sorteadas). */
export function atLeastProbability(game: LotteryGame, betSize: number, threshold: number): number {
  let p = 0;
  for (let k = threshold; k <= game.drawn; k++) p += hitProbability(game, betSize, k);
  return p;
}

export function betProbability(game: LotteryGame, betSize: number, betPrice: number): BetProbability {
  if (betSize < game.minBet || betSize > game.maxBet) {
    throw new RangeError(`betSize deve estar entre ${game.minBet} e ${game.maxBet}`);
  }
  const hitProbabilities: Record<number, number> = {};
  for (const k of game.prizeHits) hitProbabilities[k] = hitProbability(game, betSize, k);
  const atLeastNear = atLeastProbability(game, betSize, game.nearHits);
  const jackpot = hitProbabilities[game.drawn];
  const combinations = binomial(betSize, game.drawn);
  return {
    betSize,
    combinations,
    cost: Number((combinations * betPrice).toFixed(2)),
    hitProbabilities,
    atLeastNear,
    atLeastNearOneIn: Math.round(1 / atLeastNear),
    jackpot,
    jackpotOneIn: Math.round(1 / jackpot),
  };
}

export function probabilityTable(game: LotteryGame, betPrice: number): BetProbability[] {
  const rows: BetProbability[] = [];
  for (let size = game.minBet; size <= game.maxBet; size++) rows.push(betProbability(game, size, betPrice));
  return rows;
}
