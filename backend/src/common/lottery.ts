/** Regras e utilitários do domínio Lotofácil. */
export const TOTAL_NUMBERS = 25;
export const DRAWN_PER_CONTEST = 15;
export const MIN_BET_SIZE = 15;
export const MAX_BET_SIZE = 20;
export const ALL_NUMBERS: readonly number[] = Array.from({ length: TOTAL_NUMBERS }, (_, i) => i + 1);

export const PRIMES = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
export const FIBONACCI = new Set([1, 2, 3, 5, 8, 13, 21]);
/** Moldura: bordas do volante 5x5. */
export const FRAME = new Set([1, 2, 3, 4, 5, 6, 10, 11, 15, 16, 20, 21, 22, 23, 24, 25]);

export interface PrizeTier {
  hits: number;
  winners: number;
  prize: number;
}

export interface Draw {
  concurso: number;
  /** ISO yyyy-mm-dd */
  date: string;
  /** 15 dezenas em ordem crescente. */
  numbers: number[];
  /** Ordem em que foram sorteadas (quando disponível). */
  drawOrder: number[];
  prizes: PrizeTier[];
}

export function isValidGame(numbers: number[], size = DRAWN_PER_CONTEST): boolean {
  return (
    numbers.length === size &&
    new Set(numbers).size === size &&
    numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= TOTAL_NUMBERS)
  );
}

export function countHits(game: number[], drawn: number[]): number {
  const set = new Set(drawn);
  return game.reduce((acc, n) => acc + (set.has(n) ? 1 : 0), 0);
}

export function sortAsc(numbers: number[]): number[] {
  return [...numbers].sort((a, b) => a - b);
}

/** Coeficiente binomial exato (valores pequenos, cabe em Number). */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return Math.round(result);
}

/** PRNG determinístico (mulberry32) para resultados reprodutíveis. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
