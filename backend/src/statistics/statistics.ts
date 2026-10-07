import { allNumbers, Draw, LotteryGame } from '../common/lottery';

export interface GameProfile {
  sum: number;
  odds: number;
  primes: number;
  frame: number;
  fibonacci: number;
  /** Maior sequência de números consecutivos. */
  maxRun: number;
}

export interface NumberStat {
  number: number;
  frequency: number;
  frequencyPct: number;
  /** Frequência nas últimas `recentWindow` extrações. */
  recentFrequency: number;
  /** Concursos desde a última aparição (atraso). */
  delay: number;
  /** Atraso médio histórico entre aparições. */
  averageGap: number;
  maxDelay: number;
}

export interface RangeStat {
  p10: number;
  p50: number;
  p90: number;
  mean: number;
}

export interface Distribution {
  value: number;
  count: number;
  pct: number;
}

export interface UniformityTest {
  chiSquare: number;
  degreesOfFreedom: number;
  /** p-valor aproximado (Wilson–Hilferty). p > 0.05 => compatível com sorteio uniforme. */
  pValue: number;
  isUniform: boolean;
}

export function gameProfile(game: LotteryGame, numbers: number[]): GameProfile {
  const sorted = [...numbers].sort((a, b) => a - b);
  let maxRun = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === sorted[i - 1] + 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  return {
    sum: sorted.reduce((a, b) => a + b, 0),
    odds: sorted.filter((n) => n % 2 === 1).length,
    primes: sorted.filter((n) => game.primes.has(n)).length,
    frame: sorted.filter((n) => game.frame.has(n)).length,
    fibonacci: sorted.filter((n) => game.fibonacci.has(n)).length,
    maxRun,
  };
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const idx = (sortedValues.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (idx - lo);
}

export function rangeStat(values: number[]): RangeStat {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / (sorted.length || 1);
  return {
    p10: percentile(sorted, 0.1),
    p50: percentile(sorted, 0.5),
    p90: percentile(sorted, 0.9),
    mean,
  };
}

export function distribution(values: number[]): Distribution[] {
  const counts = new Map<number, number>();
  values.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([value, count]) => ({ value, count, pct: count / values.length }));
}

/** Estatísticas por dezena. `draws` deve estar em ordem crescente de concurso. */
export function numberStats(game: LotteryGame, draws: Draw[], recentWindow = game.recentWindow): NumberStat[] {
  const total = draws.length;
  const recentStart = Math.max(0, total - recentWindow);
  return allNumbers(game).map((number) => {
    let frequency = 0;
    let recentFrequency = 0;
    let lastIndex = -1;
    let maxDelay = 0;
    let gapSum = 0;
    let gapCount = 0;
    draws.forEach((draw, idx) => {
      if (draw.numbers.includes(number)) {
        frequency++;
        if (idx >= recentStart) recentFrequency++;
        if (lastIndex >= 0) {
          gapSum += idx - lastIndex;
          gapCount++;
        }
        maxDelay = Math.max(maxDelay, idx - lastIndex - 1);
        lastIndex = idx;
      }
    });
    const delay = lastIndex < 0 ? total : total - 1 - lastIndex;
    return {
      number,
      frequency,
      frequencyPct: total ? frequency / total : 0,
      recentFrequency,
      delay,
      averageGap: gapCount ? gapSum / gapCount : 0,
      maxDelay: Math.max(maxDelay, delay),
    };
  });
}

/** Quantas dezenas de cada concurso repetem do concurso anterior. */
export function repeatsFromPrevious(draws: Draw[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < draws.length; i++) {
    const prev = new Set(draws[i - 1].numbers);
    out.push(draws[i].numbers.filter((n) => prev.has(n)).length);
  }
  return out;
}

/** Matriz N×N de coocorrência (índice 0 = dezena 1). Diagonal = frequência. */
export function cooccurrenceMatrix(game: LotteryGame, draws: Draw[]): number[][] {
  const n = game.totalNumbers;
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (const draw of draws) {
    for (const a of draw.numbers) for (const b of draw.numbers) m[a - 1][b - 1]++;
  }
  return m;
}

/**
 * Teste qui-quadrado de aderência à uniformidade das frequências das dezenas.
 * Cada concurso sorteia d de N sem reposição, então cada frequência é Binomial(n, p) com
 * p = d/N e as contagens são negativamente correlacionadas. O Pearson ingênuo (÷ esperado)
 * subestima a estatística por (1 − p); a forma correta é Σ(O−E)²/(n·p·(1−p)) · (N−1)/N ~ χ²(N−1).
 */
export function uniformityTest(game: LotteryGame, draws: Draw[]): UniformityTest {
  const N = game.totalNumbers;
  const p = game.drawn / N;
  const expected = draws.length * p;
  const variance = expected * (1 - p);
  const stats = numberStats(game, draws);
  const chiSquare = variance
    ? (stats.reduce((acc, s) => acc + (s.frequency - expected) ** 2, 0) / variance) *
      ((N - 1) / N)
    : 0;
  const df = N - 1;
  // Wilson–Hilferty: (X/k)^(1/3) ~ N(1 - 2/(9k), 2/(9k))
  const z = (Math.cbrt(chiSquare / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  const pValue = 1 - normalCdf(z);
  return { chiSquare, degreesOfFreedom: df, pValue, isUniform: pValue > 0.05 };
}

export function normalCdf(z: number): number {
  // Abramowitz & Stegun 7.1.26
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
