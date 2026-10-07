import { Draw, LotteryGame } from '../common/lottery';
import { prizeForTiers } from '../backtest/backtest.engine';
import { hitProbability } from './probability';

/**
 * Retorno financeiro de um plano, com base nos prêmios médios reais dos últimos concursos.
 * Faixas fixas (11–13 na Lotofácil) usam o valor vigente; as de rateio variam conforme arrecadação e ganhadores.
 */
export interface PrizeEstimate {
  hits: number;
  prize: number;
}

export interface ReturnTier {
  hits: number;
  /** Probabilidade da faixa (aposta única: da aposta; vários jogos: de cada cartão). */
  probability: number;
  /** Quanto recebe se cair nessa faixa (aposta única: soma das combinações premiadas; vários jogos: por cartão). */
  payout: number;
}

export interface PlanReturns {
  basedOnLastDraws: number;
  expectedPrize: number;
  expectedNet: number;
  /** (prêmio esperado / custo) − 1. Ex.: −0,6 = perde 60% em média. */
  expectedReturnPct: number;
  maxPayout: number;
  probabilityScope: 'bet' | 'per-ticket';
  tiers: ReturnTier[];
}

/**
 * Prêmio por faixa: fixas usam o valor vigente; as de rateio, a média das últimas `window` vezes em
 * que a faixa teve ganhador (a Mega-Sena pode passar meses sem ganhador na sena).
 */
export function averagePrizes(game: LotteryGame, draws: Draw[], window = 50): PrizeEstimate[] {
  const desc = [...draws].reverse();
  return game.prizeHits.map((hits) => {
    if (game.fixedPrizeHits.includes(hits)) {
      const current = desc.slice(0, window).flatMap((d) => d.prizes).find((t) => t.hits === hits && t.prize > 0);
      return { hits, prize: current?.prize ?? 0 };
    }
    const values: number[] = [];
    for (const d of desc) {
      const tier = d.prizes.find((t) => t.hits === hits && t.winners > 0 && t.prize > 0);
      if (tier) values.push(tier.prize);
      if (values.length === window) break;
    }
    return { hits, prize: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 };
  });
}

export function planReturns(
  game: LotteryGame,
  betSize: number,
  tickets: number,
  cost: number,
  prizes: PrizeEstimate[],
  basedOnLastDraws: number,
): PlanReturns {
  const single = tickets <= 1;
  const size = single ? betSize : game.drawn;
  const tiers: ReturnTier[] = [];
  let evPerTicket = 0;
  for (let hits = 0; hits <= game.drawn; hits++) {
    const probability = hitProbability(game, size, hits);
    const payout = prizeForTiers(game, prizes, size, hits);
    evPerTicket += probability * payout;
    if (hits >= game.prizeHits[0]) tiers.push({ hits, probability, payout });
  }
  const expectedPrize = evPerTicket * (single ? 1 : tickets);
  return {
    basedOnLastDraws,
    expectedPrize,
    expectedNet: expectedPrize - cost,
    expectedReturnPct: cost ? expectedPrize / cost - 1 : 0,
    maxPayout: tiers[tiers.length - 1].payout,
    probabilityScope: single ? 'bet' : 'per-ticket',
    tiers,
  };
}
