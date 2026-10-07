import { binomial, countHits, Draw, LotteryGame } from '../common/lottery';
import { planBudget } from '../strategy/bet-planner';
import { hitProbability } from '../strategy/probability';
import { StrategyOptions, suggestGames } from '../strategy/strategy.engine';

/**
 * Backtest walk-forward: para cada concurso t da janela de teste, o motor só enxerga os
 * concursos < t, sugere um jogo e conferimos contra o resultado real de t. Compara com o
 * esperado de um jogo puramente aleatório (distribuição hipergeométrica exata).
 */
export interface BacktestOptions extends StrategyOptions {
  testSize?: number;
  betPrice?: number;
  /** Se informado, testa o plano recomendado para esse orçamento (ex.: 56 → 16 jogos de 15). */
  budget?: number;
}

export interface BacktestRow {
  concurso: number;
  /** Primeiro bilhete (compatibilidade). */
  game: number[];
  games: number[][];
  drawn: number[];
  /** Melhor resultado entre os bilhetes do concurso. */
  hits: number;
  ticketHits: number[];
  /** Soma dos prêmios de todos os bilhetes. */
  prize: number;
}

export interface BacktestResult {
  betSize: number;
  /** Bilhetes por concurso. */
  tickets: number;
  budget: number | null;
  plan: string;
  testSize: number;
  /** Média de acertos por bilhete. */
  meanHits: number;
  expectedRandomMeanHits: number;
  /** Intervalo de confiança 95% da média de acertos da estratégia. */
  meanHitsCi95: [number, number];
  hitDistribution: Array<{ hits: number; observed: number; expectedRandom: number }>;
  /** Concursos com algum bilhete na menor faixa premiada / na faixa quase máxima. */
  atLeastMin: number;
  atLeastNear: number;
  totalCost: number;
  totalPrize: number;
  roi: number;
  verdict: string;
  rows: BacktestRow[];
}

/** Prêmio de uma aposta de `betSize` dezenas que acertou `hits` dezenas no concurso `draw`. */
export function prizeFor(game: LotteryGame, draw: Draw, betSize: number, hits: number): number {
  return prizeForTiers(game, draw.prizes, betSize, hits);
}

export function prizeForTiers(game: LotteryGame, prizes: Array<{ hits: number; prize: number }>, betSize: number, hits: number): number {
  let total = 0;
  for (const tier of prizes) {
    // Número de jogos simples dentro da aposta que acertam exatamente tier.hits.
    const combos = binomial(hits, tier.hits) * binomial(betSize - hits, game.drawn - tier.hits);
    total += combos * tier.prize;
  }
  return total;
}

export function runBacktest(game: LotteryGame, draws: Draw[], options: BacktestOptions = {}): BacktestResult {
  const testSize = Math.min(options.testSize ?? 100, draws.length - 100);
  const betPrice = options.betPrice ?? game.defaultBetPrice;
  if (testSize <= 0) throw new Error('Histórico insuficiente para backtest.');

  let betSize = options.betSize ?? game.drawn;
  let tickets = 1;
  let plan = `1 aposta de ${betSize} dezenas`;
  if (options.budget !== undefined) {
    const recommended = planBudget(game, options.budget, betPrice).recommended;
    if (!recommended) throw new RangeError(`Orçamento insuficiente: uma aposta simples custa R$ ${betPrice.toFixed(2)}.`);
    betSize = recommended.betSize;
    tickets = recommended.tickets;
    plan = recommended.description;
  }

  const rows: BacktestRow[] = [];
  for (let t = draws.length - testSize; t < draws.length; t++) {
    const target = draws[t];
    const { games } = suggestGames(game, draws.slice(0, t), {
      ...options,
      betSize,
      games: tickets,
      candidates: options.candidates ?? Math.max(1500, tickets * 200),
      seed: target.concurso,
    });
    const numbers = games.map((g) => g.numbers);
    const ticketHits = numbers.map((g) => countHits(g, target.numbers));
    rows.push({
      concurso: target.concurso,
      game: numbers[0],
      games: numbers,
      drawn: target.numbers,
      hits: Math.max(...ticketHits),
      ticketHits,
      prize: ticketHits.reduce((a, h) => a + prizeFor(game, target, betSize, h), 0),
    });
  }

  // Unidade estatística = concurso (bilhetes do mesmo concurso não são independentes).
  const allHits = rows.flatMap((r) => r.ticketHits);
  const perDraw = rows.map((r) => r.ticketHits.reduce((a, b) => a + b, 0) / r.ticketHits.length);
  const meanHits = perDraw.reduce((a, b) => a + b, 0) / rows.length;
  const variance = perDraw.reduce((a, b) => a + (b - meanHits) ** 2, 0) / Math.max(rows.length - 1, 1);
  const margin = 1.96 * Math.sqrt(variance / rows.length);
  const expectedRandomMeanHits = (betSize * game.drawn) / game.totalNumbers;

  const minHits = Math.max(0, betSize - (game.totalNumbers - game.drawn));
  const hitDistribution = [];
  for (let h = minHits; h <= Math.min(betSize, game.drawn); h++) {
    hitDistribution.push({
      hits: h,
      observed: allHits.filter((x) => x === h).length,
      expectedRandom: hitProbability(game, betSize, h) * allHits.length,
    });
  }

  const combos = binomial(betSize, game.drawn);
  const totalCost = rows.length * tickets * combos * betPrice;
  const totalPrize = rows.reduce((a, r) => a + r.prize, 0);
  const ci: [number, number] = [meanHits - margin, meanHits + margin];
  const beatsRandom = ci[0] > expectedRandomMeanHits;
  const verdict = beatsRandom
    ? 'A estratégia ficou acima do acaso nesta janela — pode ser sorte; teste outras janelas.'
    : `Sem diferença estatística do acaso: média ${meanHits.toFixed(2)} vs ${expectedRandomMeanHits.toFixed(2)} esperado de um jogo aleatório (IC95% ${ci[0].toFixed(2)}–${ci[1].toFixed(2)}).`;

  return {
    betSize,
    tickets,
    budget: options.budget ?? null,
    plan,
    testSize: rows.length,
    meanHits,
    expectedRandomMeanHits,
    meanHitsCi95: ci,
    hitDistribution,
    atLeastMin: rows.filter((r) => r.hits >= game.prizeHits[0]).length,
    atLeastNear: rows.filter((r) => r.hits >= game.nearHits).length,
    totalCost,
    totalPrize,
    roi: totalCost ? (totalPrize - totalCost) / totalCost : 0,
    verdict,
    rows,
  };
}
