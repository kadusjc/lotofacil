import { binomial, countHits, Draw, DRAWN_PER_CONTEST, isValidGame, MAX_BET_SIZE, MIN_BET_SIZE, sortAsc } from '../common/lottery';
import { prizeFor } from '../backtest/backtest.engine';
import { computeNumberScores, DEFAULT_WEIGHTS, NumberScore, StrategyWeights } from '../strategy/strategy.engine';

/**
 * Conferência de apostas contra um concurso + diagnóstico de "onde errou" + calibração dos pesos.
 *
 * O diagnóstico mede cada sinal do ensemble pelas suas 15 dezenas favoritas: quantas saíram de fato.
 * Um sinal sem poder preditivo acerta em média 9 (= 15·15/25). A calibração repete isso
 * walk-forward nos últimos concursos e ajusta os pesos por Hedge (pesos multiplicativos):
 * sinais que acertaram acima do acaso ganham peso, os abaixo perdem. Isso não muda a
 * probabilidade real do sorteio; o backtest continua sendo o juiz.
 */
export type Signal = keyof NumberScore['components'];
export const SIGNALS: Signal[] = ['long', 'recent', 'momentum', 'delay', 'analog'];
/** Mínimo de concursos anteriores para os sinais (estatísticas e análogos) fazerem sentido. */
const MIN_HISTORY = 30;
export const RANDOM_TOP15_HITS = (DRAWN_PER_CONTEST * DRAWN_PER_CONTEST) / 25; // 9

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
  /** Acertos das 15 dezenas mais bem pontuadas por este sinal no concurso conferido. */
  top15Hits: number;
  /** Média walk-forward na janela de calibração. */
  meanTop15Hits: number;
  /** Nota média (z) do sinal nas dezenas apostadas que saíram menos nas que não saíram. */
  betAdvantage: number;
  previousWeight: number;
  newWeight: number;
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
  calibrationWindow: number;
  learnedWeights: StrategyWeights;
}

export function validateBets(bets: number[][]): string | null {
  for (let i = 0; i < bets.length; i++) {
    const b = bets[i];
    if (b.length < MIN_BET_SIZE || b.length > MAX_BET_SIZE || !isValidGame(b, b.length)) {
      return `Aposta ${i + 1}: informe de ${MIN_BET_SIZE} a ${MAX_BET_SIZE} dezenas distintas entre 1 e 25.`;
    }
  }
  return null;
}

export function checkBet(draw: Draw, numbers: number[], betPrice: number): BetCheck {
  const sorted = sortAsc(numbers);
  const drawn = new Set(draw.numbers);
  const hits = countHits(sorted, draw.numbers);
  return {
    numbers: sorted,
    betSize: sorted.length,
    cost: Number((binomial(sorted.length, DRAWN_PER_CONTEST) * betPrice).toFixed(2)),
    hits,
    hitNumbers: sorted.filter((n) => drawn.has(n)),
    prize: prizeFor(draw, sorted.length, hits),
  };
}

/** Acertos das top-15 dezenas de cada sinal, usando só o histórico anterior ao concurso. */
export function signalHits(history: Draw[], target: Draw): Record<Signal, number> {
  const { scores } = computeNumberScores(history);
  const drawn = new Set(target.numbers);
  const out = {} as Record<Signal, number>;
  for (const s of SIGNALS) {
    const top = [...scores].sort((a, b) => b.components[s] - a.components[s]).slice(0, DRAWN_PER_CONTEST);
    out[s] = top.filter((x) => drawn.has(x.number)).length;
  }
  return out;
}

/**
 * Calibração walk-forward (Hedge): peso_s = padrão_s · exp(η · (média_s − 9)), renormalizado para
 * manter a soma dos pesos padrão. `history` em ordem crescente; avalia os últimos `window` concursos.
 */
export function calibrateWeights(
  history: Draw[],
  window = 30,
  eta = 0.5,
): { weights: StrategyWeights; mean: Record<Signal, number>; window: number } {
  const n = Math.min(window, history.length - 100);
  const sums = Object.fromEntries(SIGNALS.map((s) => [s, 0])) as Record<Signal, number>;
  for (let t = history.length - n; t < history.length; t++) {
    const h = signalHits(history.slice(0, t), history[t]);
    for (const s of SIGNALS) sums[s] += h[s];
  }
  const mean = Object.fromEntries(SIGNALS.map((s) => [s, n > 0 ? sums[s] / n : RANDOM_TOP15_HITS])) as Record<Signal, number>;
  const raw = SIGNALS.map((s) => DEFAULT_WEIGHTS[s] * Math.exp(eta * (mean[s] - RANDOM_TOP15_HITS)));
  const total = SIGNALS.reduce((a, s) => a + DEFAULT_WEIGHTS[s], 0);
  const rawTotal = raw.reduce((a, b) => a + b, 0);
  const weights = { ...DEFAULT_WEIGHTS };
  SIGNALS.forEach((s, i) => (weights[s] = Number(((raw[i] / rawTotal) * total).toFixed(4))));
  return { weights, mean, window: Math.max(n, 0) };
}

/**
 * Aprendizado pelas apostas conferidas: compara a nota (z-score) que cada sinal deu às dezenas
 * marcadas que saíram contra as marcadas que não saíram. Vantagem positiva = o sinal apontava
 * para os acertos. Sem acertos ou sem erros, não há contraste e a vantagem é 0.
 */
export function betAdvantage(history: Draw[], picked: number[], drawn: number[]): Record<Signal, number> {
  const { scores } = computeNumberScores(history);
  const isDrawn = new Set(drawn);
  const hit = picked.filter((n) => isDrawn.has(n));
  const miss = picked.filter((n) => !isDrawn.has(n));
  const mean = (ns: number[], s: Signal) => ns.reduce((a, n) => a + scores[n - 1].components[s], 0) / ns.length;
  return Object.fromEntries(
    SIGNALS.map((s) => [s, hit.length && miss.length ? mean(hit, s) - mean(miss, s) : 0]),
  ) as Record<Signal, number>;
}

/**
 * Pesos finais: calibração walk-forward × exp(η · vantagem nas apostas), misturados com os pesos
 * anteriores (média móvel) para que cada conferência acumule sem que uma só domine.
 */
export function learnFromBets(
  calibrated: StrategyWeights,
  previous: StrategyWeights,
  advantage: Record<Signal, number>,
  eta = 0.5,
  memory = 0.3,
): StrategyWeights {
  const total = SIGNALS.reduce((a, s) => a + calibrated[s], 0);
  const raw = SIGNALS.map((s) => calibrated[s] * Math.exp(eta * advantage[s]));
  const rawTotal = raw.reduce((a, b) => a + b, 0);
  const prevTotal = SIGNALS.reduce((a, s) => a + previous[s], 0) || total;
  const out = { ...calibrated };
  SIGNALS.forEach((s, i) => {
    const fresh = (raw[i] / rawTotal) * total;
    const prev = (previous[s] / prevTotal) * total;
    out[s] = Number(((1 - memory) * fresh + memory * prev).toFixed(4));
  });
  return out;
}

export interface CheckArgs {
  bets: number[][];
  concurso: number;
  betPrice: number;
  previousWeights: StrategyWeights;
  window?: number;
}

/** `draws` em ordem crescente; confere contra `concurso` e recalibra com todo o histórico. */
export function runCheck(draws: Draw[], { bets, concurso, betPrice, previousWeights, window }: CheckArgs): CheckResult {
  const idx = draws.findIndex((d) => d.concurso === concurso);
  if (idx < 0) throw new RangeError(`Concurso ${concurso} não encontrado`);
  const error = validateBets(bets);
  if (error) throw new RangeError(error);
  const draw = draws[idx];
  if (idx < MIN_HISTORY) throw new RangeError(`Histórico insuficiente antes do concurso ${concurso} para avaliar os sinais.`);

  const checks = bets.map((b) => checkBet(draw, b, betPrice));
  const picked = new Set(checks.flatMap((c) => c.numbers));
  const drawn = new Set(draw.numbers);
  const cost = checks.reduce((a, c) => a + c.cost, 0);
  const prize = checks.reduce((a, c) => a + c.prize, 0);

  const today = signalHits(draws.slice(0, idx), draw);
  // Calibra sempre com o histórico completo: conferir um concurso antigo não deve "regredir" o modelo.
  const calibration = calibrateWeights(draws, window);
  const advantage = betAdvantage(draws.slice(0, idx), [...picked], draw.numbers);
  const learned = learnFromBets(calibration.weights, previousWeights, advantage);

  return {
    draw,
    bets: checks,
    totals: { cost: Number(cost.toFixed(2)), prize, net: prize - cost, winningBets: checks.filter((c) => c.prize > 0).length },
    missedDrawn: draw.numbers.filter((n) => !picked.has(n)),
    wrongPicks: sortAsc([...picked].filter((n) => !drawn.has(n))),
    signals: SIGNALS.map((s) => ({
      signal: s,
      top15Hits: today[s],
      meanTop15Hits: calibration.mean[s],
      betAdvantage: Number(advantage[s].toFixed(3)),
      previousWeight: previousWeights[s],
      newWeight: learned[s],
    })),
    calibrationWindow: calibration.window,
    learnedWeights: learned,
  };
}
