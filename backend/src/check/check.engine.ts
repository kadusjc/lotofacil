import { binomial, countHits, Draw, isValidGame, LotteryGame, sortAsc } from '../common/lottery';
import { prizeFor } from '../backtest/backtest.engine';
import { computeNumberScores, NumberScore } from '../strategy/strategy.engine';

/**
 * Conferência de apostas contra um concurso + diagnóstico de "onde errou".
 *
 * O diagnóstico mede cada sinal do ensemble pelas suas d dezenas favoritas (d = dezenas sorteadas):
 * quantas saíram de fato. Um sinal sem poder preditivo acerta em média d²/N (9 na Lotofácil, com
 * desvio-padrão ~1,2 por concurso; 0,6 na Mega-Sena).
 * A conferência NÃO altera os pesos: com sorteios independentes, ajustar pesos pelos últimos
 * resultados só persegue ruído (sobreajuste) e não muda a chance de nenhum jogo.
 */
export type Signal = keyof NumberScore['components'];
export const SIGNALS: Signal[] = ['long', 'recent', 'momentum', 'delay', 'analog'];
/** Mínimo de concursos anteriores para os sinais (estatísticas e análogos) fazerem sentido. */
const MIN_HISTORY = 30;

/** Acertos esperados das d favoritas de um sinal sem poder preditivo: d²/N. */
export function randomTopHits(game: LotteryGame): number {
  return (game.drawn * game.drawn) / game.totalNumbers;
}

export interface BetCheck {
  numbers: number[];
  betSize: number;
  cost: number;
  hits: number;
  hitNumbers: number[];
  prize: number;
}

export interface SignalReport {
  signal: Signal;
  /** Acertos das d dezenas mais bem pontuadas por este sinal no concurso conferido. */
  topHits: number;
  /** Média walk-forward nos últimos `window` concursos até o conferido. */
  meanTopHits: number;
}

export interface CheckResult {
  draw: Draw;
  bets: BetCheck[];
  totals: { cost: number; prize: number; net: number; winningBets: number };
  /** Dezenas sorteadas que nenhuma aposta marcou. */
  missedDrawn: number[];
  /** Dezenas marcadas (em alguma aposta) que não saíram. */
  wrongPicks: number[];
  signals: SignalReport[];
  /** Quantas favoritas cada sinal escolhe (d) e quantas acertaria por puro acaso (d²/N). */
  topSize: number;
  randomTopHits: number;
  calibrationWindow: number;
}

export function validateBets(game: LotteryGame, bets: number[][]): string | null {
  for (let i = 0; i < bets.length; i++) {
    const b = bets[i];
    if (!Array.isArray(b) || b.length < game.minBet || b.length > game.maxBet || !isValidGame(game, b, b.length)) {
      return `Aposta ${i + 1}: informe de ${game.minBet} a ${game.maxBet} dezenas distintas entre 1 e ${game.totalNumbers}.`;
    }
  }
  return null;
}

export function checkBet(game: LotteryGame, draw: Draw, numbers: number[], betPrice: number): BetCheck {
  const sorted = sortAsc(numbers);
  const drawn = new Set(draw.numbers);
  const hits = countHits(sorted, draw.numbers);
  return {
    numbers: sorted,
    betSize: sorted.length,
    cost: Number((binomial(sorted.length, game.drawn) * betPrice).toFixed(2)),
    hits,
    hitNumbers: sorted.filter((n) => drawn.has(n)),
    prize: prizeFor(game, draw, sorted.length, hits),
  };
}

/** Acertos das top-d dezenas de cada sinal, usando só o histórico anterior ao concurso. */
export function signalHits(game: LotteryGame, history: Draw[], target: Draw): Record<Signal, number> {
  const { scores } = computeNumberScores(game, history);
  const drawn = new Set(target.numbers);
  const out = {} as Record<Signal, number>;
  for (const s of SIGNALS) {
    const top = [...scores].sort((a, b) => b.components[s] - a.components[s]).slice(0, game.drawn);
    out[s] = top.filter((x) => drawn.has(x.number)).length;
  }
  return out;
}

/** Média walk-forward de acertos das top-d de cada sinal nos últimos `window` concursos de `history` (crescente). */
export function signalTrackRecord(game: LotteryGame, history: Draw[], window = 30): { mean: Record<Signal, number>; window: number } {
  const n = Math.min(window, history.length - 100);
  const sums = Object.fromEntries(SIGNALS.map((s) => [s, 0])) as Record<Signal, number>;
  for (let t = history.length - n; t < history.length; t++) {
    const h = signalHits(game, history.slice(0, t), history[t]);
    for (const s of SIGNALS) sums[s] += h[s];
  }
  const mean = Object.fromEntries(SIGNALS.map((s) => [s, n > 0 ? sums[s] / n : randomTopHits(game)])) as Record<Signal, number>;
  return { mean, window: Math.max(n, 0) };
}

export interface CheckArgs {
  bets: number[][];
  concurso: number;
  betPrice: number;
  window?: number;
}

/** `draws` em ordem crescente; confere contra `concurso`. */
export function runCheck(game: LotteryGame, draws: Draw[], { bets, concurso, betPrice, window }: CheckArgs): CheckResult {
  const idx = draws.findIndex((d) => d.concurso === concurso);
  if (idx < 0) throw new RangeError(`Concurso ${concurso} não encontrado`);
  const error = validateBets(game, bets);
  if (error) throw new RangeError(error);
  const draw = draws[idx];
  if (idx < MIN_HISTORY) throw new RangeError(`Histórico insuficiente antes do concurso ${concurso} para avaliar os sinais.`);

  const checks = bets.map((b) => checkBet(game, draw, b, betPrice));
  const picked = new Set(checks.flatMap((c) => c.numbers));
  const drawn = new Set(draw.numbers);
  const cost = checks.reduce((a, c) => a + c.cost, 0);
  const prize = checks.reduce((a, c) => a + c.prize, 0);

  const today = signalHits(game, draws.slice(0, idx), draw);
  const calibration = signalTrackRecord(game, draws.slice(0, idx + 1), window);

  return {
    draw,
    bets: checks,
    totals: { cost: Number(cost.toFixed(2)), prize, net: prize - cost, winningBets: checks.filter((c) => c.prize > 0).length },
    missedDrawn: draw.numbers.filter((n) => !picked.has(n)),
    wrongPicks: sortAsc([...picked].filter((n) => !drawn.has(n))),
    signals: SIGNALS.map((s) => ({
      signal: s,
      topHits: today[s],
      meanTopHits: calibration.mean[s],
    })),
    topSize: game.drawn,
    randomTopHits: randomTopHits(game),
    calibrationWindow: calibration.window,
  };
}
