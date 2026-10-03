import { Draw, DRAWN_PER_CONTEST } from '../common/lottery';
import { prizeForTiers } from '../backtest/backtest.engine';
import { hitProbability } from './probability';

/**
 * Retorno financeiro de um plano, com base nos prêmios médios reais dos últimos concursos.
 * 11, 12 e 13 acertos têm valor fixo; 14 e 15 variam conforme arrecadação e número de ganhadores.
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

/** Prêmio médio por faixa nos últimos `window` concursos (só concursos com ganhador na faixa). */
export function averagePrizes(draws: Draw[], window = 50): PrizeEstimate[] {
  const recent = draws.slice(-window);
  const out: PrizeEstimate[] = [];
  for (let hits = 11; hits <= 15; hits++) {
    // 11–13 são fixos: usa o valor vigente (último concurso com ganhador na faixa).
    if (hits <= 13) {
      const current = [...recent].reverse().flatMap((d) => d.prizes).find((t) => t.hits === hits && t.prize > 0);
      out.push({ hits, prize: current?.prize ?? 0 });
      continue;
    }
    const values = recent
      .flatMap((d) => d.prizes.filter((t) => t.hits === hits && t.winners > 0 && t.prize > 0))
      .map((t) => t.prize);
    out.push({ hits, prize: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 });
  }
  return out;
}

export function planReturns(
  betSize: number,
  tickets: number,
  cost: number,
  prizes: PrizeEstimate[],
  basedOnLastDraws: number,
): PlanReturns {
  const single = tickets <= 1;
  const size = single ? betSize : DRAWN_PER_CONTEST;
  const tiers: ReturnTier[] = [];
  let evPerTicket = 0;
  for (let hits = 0; hits <= DRAWN_PER_CONTEST; hits++) {
    const probability = hitProbability(size, hits);
    const payout = prizeForTiers(prizes, size, hits);
    evPerTicket += probability * payout;
    if (hits >= 11) tiers.push({ hits, probability, payout });
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
