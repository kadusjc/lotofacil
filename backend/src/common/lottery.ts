/** Regras e utilitários das loterias "escolha N de M" da Caixa (Lotofácil, Mega-Sena, Quina, Dia de Sorte). */
export type GameId = 'lotofacil' | 'megasena' | 'quina' | 'diadesorte';
export type ProfileKey = 'sum' | 'odds' | 'primes' | 'frame' | 'fibonacci' | 'maxRun';

export interface LotteryGame {
  id: GameId;
  name: string;
  totalNumbers: number;
  /** Dezenas sorteadas por concurso (= tamanho da aposta simples). */
  drawn: number;
  minBet: number;
  maxBet: number;
  /** Faixas premiadas (acertos), em ordem crescente. */
  prizeHits: number[];
  /** Faixas de valor fixo; as demais dividem o rateio. */
  fixedPrizeHits: number[];
  /** Faixa "quase máxima" usada para comparar planos (14+ na Lotofácil, quina na Mega, quadra na Quina). */
  nearHits: number;
  defaultBetPrice: number;
  caixaSlug: string;
  portalUrl: string;
  /** Colunas do volante (para moldura). */
  gridColumns: number;
  /** Janela de "quentes" e meia-vida do momentum, escaladas para ~15 aparições esperadas por dezena. */
  recentWindow: number;
  momentumHalfLife: number;
  /** Rótulos e nomes de schema no Neo4j (Lotofácil mantém os originais). */
  graph: { draw: string; number: string; bet: string; drawConstraint: string; numberConstraint: string; dateIndex: string; vectorIndex: string };
  /** [média, meia-amplitude ≈ 3,3 desvios] de cada feature de perfil num sorteio aleatório. */
  profileNormalization: Array<[ProfileKey, number, number]>;
  primes: Set<number>;
  fibonacci: Set<number>;
  frame: Set<number>;
}

function primesUpTo(n: number): Set<number> {
  const out = new Set<number>();
  for (let i = 2; i <= n; i++) {
    let prime = true;
    for (let d = 2; d * d <= i; d++) if (i % d === 0) prime = false;
    if (prime) out.add(i);
  }
  return out;
}

function fibonacciUpTo(n: number): Set<number> {
  const out = new Set<number>([1]);
  for (let a = 1, b = 2; b <= n; [a, b] = [b, a + b]) out.add(b);
  return out;
}

/** Bordas do volante (primeira/última linha e coluna). */
function frameOf(total: number, columns: number): Set<number> {
  const rows = Math.ceil(total / columns);
  const out = new Set<number>();
  for (let n = 1; n <= total; n++) {
    const r = Math.floor((n - 1) / columns);
    const c = (n - 1) % columns;
    if (r === 0 || r === rows - 1 || c === 0 || c === columns - 1) out.add(n);
  }
  return out;
}

type GameSpec = Omit<LotteryGame, 'primes' | 'fibonacci' | 'frame'>;

function defineGame(spec: GameSpec): LotteryGame {
  return {
    ...spec,
    primes: primesUpTo(spec.totalNumbers),
    fibonacci: fibonacciUpTo(spec.totalNumbers),
    frame: frameOf(spec.totalNumbers, spec.gridColumns),
  };
}

export const LOTOFACIL = defineGame({
  id: 'lotofacil',
  name: 'Lotofácil',
  totalNumbers: 25,
  drawn: 15,
  minBet: 15,
  maxBet: 20,
  prizeHits: [11, 12, 13, 14, 15],
  fixedPrizeHits: [11, 12, 13],
  nearHits: 14,
  defaultBetPrice: 3.5,
  caixaSlug: 'lotofacil',
  portalUrl: 'https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx',
  gridColumns: 5,
  recentWindow: 25,
  momentumHalfLife: 20,
  graph: {
    draw: 'Draw',
    number: 'Number',
    bet: 'Bet',
    drawConstraint: 'draw_concurso',
    numberConstraint: 'number_value',
    dateIndex: 'draw_date',
    vectorIndex: 'draw_embedding_index',
  },
  profileNormalization: [
    ['sum', 195, 60],
    ['odds', 7.8, 4],
    ['primes', 5.4, 4],
    ['frame', 9.6, 4],
    ['fibonacci', 4.2, 3],
    ['maxRun', 4.5, 4],
  ],
});

export const MEGASENA = defineGame({
  id: 'megasena',
  name: 'Mega-Sena',
  totalNumbers: 60,
  drawn: 6,
  minBet: 6,
  maxBet: 20,
  prizeHits: [4, 5, 6],
  fixedPrizeHits: [],
  nearHits: 5,
  defaultBetPrice: 6,
  caixaSlug: 'megasena',
  portalUrl: 'https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx',
  gridColumns: 10,
  recentWindow: 150,
  momentumHalfLife: 120,
  graph: {
    draw: 'MegaDraw',
    number: 'MegaNumber',
    bet: 'MegaBet',
    drawConstraint: 'megadraw_concurso',
    numberConstraint: 'meganumber_value',
    dateIndex: 'megadraw_date',
    vectorIndex: 'megadraw_embedding_index',
  },
  profileNormalization: [
    ['sum', 183, 134],
    ['odds', 3, 3.9],
    ['primes', 1.7, 3.5],
    ['frame', 2.8, 3.9],
    ['fibonacci', 0.9, 2.8],
    ['maxRun', 1.45, 1.9],
  ],
});

export const QUINA = defineGame({
  id: 'quina',
  name: 'Quina',
  totalNumbers: 80,
  drawn: 5,
  minBet: 5,
  maxBet: 15,
  prizeHits: [2, 3, 4, 5],
  fixedPrizeHits: [],
  nearHits: 4,
  defaultBetPrice: 3,
  caixaSlug: 'quina',
  portalUrl: 'https://loterias.caixa.gov.br/Paginas/Quina.aspx',
  gridColumns: 10,
  recentWindow: 240,
  momentumHalfLife: 190,
  graph: {
    draw: 'QuinaDraw',
    number: 'QuinaNumber',
    bet: 'QuinaBet',
    drawConstraint: 'quinadraw_concurso',
    numberConstraint: 'quinanumber_value',
    dateIndex: 'quinadraw_date',
    vectorIndex: 'quinadraw_embedding_index',
  },
  profileNormalization: [
    ['sum', 202.5, 166],
    ['odds', 2.5, 3.6],
    ['primes', 1.4, 3.2],
    ['frame', 2, 3.5],
    ['fibonacci', 0.56, 2.3],
    ['maxRun', 1.24, 1.5],
  ],
});

/**
 * Dia de Sorte: além das 7 dezenas, o apostador escolhe um "Mês da Sorte" (1 em 12, prêmio fixo
 * baixo). O mês é independente das dezenas e fica fora das contas e das sugestões; o parser
 * descarta essa faixa (não tem "N acertos").
 */
export const DIADESORTE = defineGame({
  id: 'diadesorte',
  name: 'Dia de Sorte',
  totalNumbers: 31,
  drawn: 7,
  minBet: 7,
  maxBet: 15,
  prizeHits: [4, 5, 6, 7],
  fixedPrizeHits: [4, 5],
  nearHits: 6,
  defaultBetPrice: 2.5,
  caixaSlug: 'diadesorte',
  portalUrl: 'https://loterias.caixa.gov.br/Paginas/Dia-de-Sorte.aspx',
  gridColumns: 7,
  recentWindow: 66,
  momentumHalfLife: 53,
  graph: {
    draw: 'SorteDraw',
    number: 'SorteNumber',
    bet: 'SorteBet',
    drawConstraint: 'sortedraw_concurso',
    numberConstraint: 'sortenumber_value',
    dateIndex: 'sortedraw_date',
    vectorIndex: 'sortedraw_embedding_index',
  },
  profileNormalization: [
    ['sum', 112, 70],
    ['odds', 3.6, 3.9],
    ['primes', 2.5, 3.7],
    ['frame', 3.6, 3.9],
    ['fibonacci', 1.6, 3.3],
    ['maxRun', 2, 2.3],
  ],
});

export const GAMES: Record<GameId, LotteryGame> = { lotofacil: LOTOFACIL, megasena: MEGASENA, quina: QUINA, diadesorte: DIADESORTE };
export const GAME_IDS = Object.keys(GAMES) as GameId[];

export function isGameId(value: unknown): value is GameId {
  // Object.hasOwn: `in` aceitaria chaves do protótipo ("constructor", "toString", "__proto__").
  return typeof value === 'string' && Object.hasOwn(GAMES, value);
}

/** Dezenas 1..totalNumbers. */
export function allNumbers(game: LotteryGame): number[] {
  return Array.from({ length: game.totalNumbers }, (_, i) => i + 1);
}

/** Combinações possíveis de um sorteio: C(total, drawn). */
export function totalCombinations(game: LotteryGame): number {
  return binomial(game.totalNumbers, game.drawn);
}

export interface PrizeTier {
  hits: number;
  winners: number;
  prize: number;
}

export interface Draw {
  concurso: number;
  /** ISO yyyy-mm-dd */
  date: string;
  /** Dezenas sorteadas em ordem crescente. */
  numbers: number[];
  /** Ordem em que foram sorteadas (quando disponível). */
  drawOrder: number[];
  prizes: PrizeTier[];
}

export function isValidGame(game: LotteryGame, numbers: number[], size = game.drawn): boolean {
  return (
    numbers.length === size &&
    new Set(numbers).size === size &&
    numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= game.totalNumbers)
  );
}

export function countHits(game: number[], drawn: number[]): number {
  const set = new Set(drawn);
  return game.reduce((acc, n) => acc + (set.has(n) ? 1 : 0), 0);
}

export function sortAsc(numbers: number[]): number[] {
  return [...numbers].sort((a, b) => a - b);
}

/** Conjunto de dezenas como bitmask em palavras de 32 bits (suporta até 96 dezenas). */
export type Mask = [number, number, number];

export function toMask(numbers: number[]): Mask {
  const m: Mask = [0, 0, 0];
  for (const n of numbers) m[(n - 1) >>> 5] |= 1 << ((n - 1) & 31);
  return m;
}

/** Dezenas em comum entre dois conjuntos. */
export function maskOverlap(a: Mask, b: Mask): number {
  return popcount(a[0] & b[0]) + popcount(a[1] & b[1]) + popcount(a[2] & b[2]);
}

export function popcount(x: number): number {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
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
