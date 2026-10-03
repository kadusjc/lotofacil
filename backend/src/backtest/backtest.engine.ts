import { binomial, countHits, Draw, DRAWN_PER_CONTEST } from '../common/lottery';
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
}

export interface BacktestRow {
  concurso: number;
  game: number[];
  drawn: number[];
  hits: number;
  prize: number;
}

export interface BacktestResult {
  betSize: number;
  testSize: number;
  meanHits: number;
  expectedRandomMeanHits: number;
  /** Intervalo de confiança 95% da média de acertos da estratégia. */
  meanHitsCi95: [number, number];
  hitDistribution: Array<{ hits: number; observed: number; expectedRandom: number }>;
  atLeast11: number;
  atLeast14: number;
  totalCost: number;
  totalPrize: number;
  roi: number;
  verdict: string;
  rows: BacktestRow[];
}

/** Prêmio de uma aposta de `betSize` dezenas que acertou `hits` dezenas no concurso `draw`. */
export function prizeFor(draw: Draw, betSize: number, hits: number): number {
  return prizeForTiers(draw.prizes, betSize, hits);
}

export function prizeForTiers(prizes: Array<{ hits: number; prize: number }>, betSize: number, hits: number): number {
  let total = 0;
  for (const tier of prizes) {
    // Número de combinações de 15 dentro da aposta que acertam exatamente tier.hits.
    const combos = binomial(hits, tier.hits) * binomial(betSize - hits, DRAWN_PER_CONTEST - tier.hits);
    total += combos * tier.prize;
  }
  return total;
}

export function runBacktest(draws: Draw[], options: BacktestOptions = {}): BacktestResult {
  const betSize = options.betSize ?? DRAWN_PER_CONTEST;
  const testSize = Math.min(options.testSize ?? 100, draws.length - 100);
  const betPrice = options.betPrice ?? 3.5;
  if (testSize <= 0) throw new Error('Histórico insuficiente para backtest.');

  const rows: BacktestRow[] = [];
  for (let t = draws.length - testSize; t < draws.length; t++) {
    const train = draws.slice(0, t);
    const target = draws[t];
    const { games } = suggestGames(train, {
      ...options,
      betSize,
      games: 1,
      candidates: options.candidates ?? 1500,
      seed: target.concurso,
    });
    const game = games[0].numbers;
    const hits = countHits(game, target.numbers);
    rows.push({ concurso: target.concurso, game, drawn: target.numbers, hits, prize: prizeFor(target, betSize, hits) });
  }

  const hitsList = rows.map((r) => r.hits);
  const meanHits = hitsList.reduce((a, b) => a + b, 0) / rows.length;
  const variance = hitsList.reduce((a, b) => a + (b - meanHits) ** 2, 0) / Math.max(rows.length - 1, 1);
  const margin = 1.96 * Math.sqrt(variance / rows.length);
  const expectedRandomMeanHits = (betSize * DRAWN_PER_CONTEST) / 25;

  const minHits = Math.max(0, betSize - 10);
  const hitDistribution = [];
  for (let h = minHits; h <= DRAWN_PER_CONTEST; h++) {
    hitDistribution.push({
      hits: h,
      observed: hitsList.filter((x) => x === h).length,
      expectedRandom: hitProbability(betSize, h) * rows.length,
    });
  }

  const combos = binomial(betSize, DRAWN_PER_CONTEST);
  const totalCost = rows.length * combos * betPrice;
  const totalPrize = rows.reduce((a, r) => a + r.prize, 0);
  const ci: [number, number] = [meanHits - margin, meanHits + margin];
  const beatsRandom = ci[0] > expectedRandomMeanHits;
  const verdict = beatsRandom
    ? 'A estratégia ficou acima do acaso nesta janela — pode ser sorte; teste outras janelas.'
    : `Sem diferença estatística do acaso: média ${meanHits.toFixed(2)} vs ${expectedRandomMeanHits.toFixed(2)} esperado de um jogo aleatório (IC95% ${ci[0].toFixed(2)}–${ci[1].toFixed(2)}).`;

  return {
    betSize,
    testSize: rows.length,
    meanHits,
    expectedRandomMeanHits,
    meanHitsCi95: ci,
    hitDistribution,
    atLeast11: hitsList.filter((h) => h >= 11).length,
    atLeast14: hitsList.filter((h) => h >= 14).length,
    totalCost,
    totalPrize,
    roi: totalCost ? (totalPrize - totalCost) / totalCost : 0,
    verdict,
    rows,
  };
}
