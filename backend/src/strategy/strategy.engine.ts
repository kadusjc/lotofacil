import {
  ALL_NUMBERS,
  createRng,
  Draw,
  DRAWN_PER_CONTEST,
  MAX_BET_SIZE,
  MIN_BET_SIZE,
  sortAsc,
  TOTAL_NUMBERS,
} from '../common/lottery';
import { drawEmbedding, gameCohesion, nearestNeighbors, numberEmbeddings } from '../embeddings/embeddings';
import {
  cooccurrenceMatrix,
  gameProfile,
  GameProfile,
  numberStats,
  rangeStat,
  repeatsFromPrevious,
} from '../statistics/statistics';

/**
 * Motor de sugestão de jogos.
 *
 * Cada dezena recebe um score por um ensemble de sinais (todos padronizados em z-score):
 *  - long     : frequência em todo o histórico
 *  - recent   : frequência nos últimos N concursos ("quentes")
 *  - momentum : frequência com decaimento exponencial
 *  - delay    : atraso atual relativo ao intervalo médio ("atrasadas")
 *  - analog   : busca por similaridade de embeddings — concursos mais parecidos com o último e
 *               o que veio logo depois deles (previsão por análogos / k-NN)
 *
 * Em seguida, gera milhares de jogos candidatos por amostragem ponderada, descarta os que fogem do
 * perfil histórico típico (soma, ímpares, primos, moldura, repetidas do último concurso) e
 * ranqueia por score + coesão (embeddings PPMI das dezenas).
 *
 * IMPORTANTE: sorteios são independentes e uniformes; nenhum sinal acima altera a probabilidade
 * real de acerto. O backtest existe justamente para medir isso de forma honesta.
 */
export interface StrategyWeights {
  long: number;
  recent: number;
  momentum: number;
  delay: number;
  analog: number;
  cohesion: number;
}

export const DEFAULT_WEIGHTS: StrategyWeights = {
  long: 0.15,
  recent: 0.25,
  momentum: 0.2,
  delay: 0.15,
  analog: 0.25,
  cohesion: 0.3,
};

export interface StrategyOptions {
  betSize?: number;
  games?: number;
  seed?: number;
  candidates?: number;
  /** Sobreposição máxima entre jogos sugeridos (diversidade = mais cobertura). */
  maxOverlap?: number;
  weights?: Partial<StrategyWeights>;
  recentWindow?: number;
  analogNeighbors?: number;
}

export interface NumberScore {
  number: number;
  score: number;
  components: Record<'long' | 'recent' | 'momentum' | 'delay' | 'analog', number>;
}

export interface ProfileBounds {
  sum: [number, number];
  odds: [number, number];
  primes: [number, number];
  frame: [number, number];
  repeats: [number, number];
}

export interface SuggestedGame {
  numbers: number[];
  score: number;
  cohesion: number;
  profile: GameProfile;
  repeatsFromLast: number;
}

export interface StrategyResult {
  basedOnConcurso: number;
  betSize: number;
  games: SuggestedGame[];
  numberScores: NumberScore[];
  profileBounds: ProfileBounds;
  analogConcursos: Array<{ concurso: number; similarity: number }>;
}

type Component = keyof NumberScore['components'];

export function zScores(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return values.map((v) => (sd ? (v - mean) / sd : 0));
}

export function computeNumberScores(
  draws: Draw[],
  weights: StrategyWeights = DEFAULT_WEIGHTS,
  recentWindow = 25,
  analogNeighbors = 30,
): { scores: NumberScore[]; analogs: Array<{ index: number; similarity: number }> } {
  const stats = numberStats(draws, recentWindow);

  const momentumRaw = new Array<number>(TOTAL_NUMBERS).fill(0);
  const halfLife = 20;
  const decay = Math.pow(0.5, 1 / halfLife);
  let w = 1;
  for (let i = draws.length - 1; i >= 0 && w > 1e-4; i--) {
    for (const n of draws[i].numbers) momentumRaw[n - 1] += w;
    w *= decay;
  }

  // Previsão por análogos: vizinhos do último concurso (excluindo ele mesmo) e seus sucessores.
  const analogRaw = new Array<number>(TOTAL_NUMBERS).fill(0);
  let analogs: Array<{ index: number; similarity: number }> = [];
  if (draws.length > 2) {
    const vectors = draws.map((d) => drawEmbedding(d.numbers));
    const last = draws.length - 1;
    analogs = nearestNeighbors(vectors[last], vectors.slice(0, last), analogNeighbors);
    for (const { index, similarity } of analogs) {
      for (const n of draws[index + 1].numbers) analogRaw[n - 1] += Math.max(similarity, 0);
    }
  }

  const raw: Record<Component, number[]> = {
    long: stats.map((s) => s.frequencyPct),
    recent: stats.map((s) => s.recentFrequency),
    momentum: momentumRaw,
    delay: stats.map((s) => (s.averageGap ? s.delay / s.averageGap : 0)),
    analog: analogRaw,
  };
  const z = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, zScores(v)]),
  ) as Record<Component, number[]>;

  const scores = ALL_NUMBERS.map((number, i) => {
    const components = {
      long: z.long[i],
      recent: z.recent[i],
      momentum: z.momentum[i],
      delay: z.delay[i],
      analog: z.analog[i],
    };
    const score = (Object.keys(components) as Component[]).reduce(
      (acc, k) => acc + weights[k] * components[k],
      0,
    );
    return { number, score, components };
  });
  return { scores, analogs };
}

export function computeProfileBounds(draws: Draw[]): ProfileBounds {
  const profiles = draws.map((d) => gameProfile(d.numbers));
  const bounds = (values: number[]): [number, number] => {
    const r = rangeStat(values);
    return [Math.floor(r.p10), Math.ceil(r.p90)];
  };
  return {
    sum: bounds(profiles.map((p) => p.sum)),
    odds: bounds(profiles.map((p) => p.odds)),
    primes: bounds(profiles.map((p) => p.primes)),
    frame: bounds(profiles.map((p) => p.frame)),
    repeats: bounds(repeatsFromPrevious(draws)),
  };
}

export function fitsProfile(
  profile: GameProfile,
  repeats: number,
  b: ProfileBounds,
): boolean {
  const within = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;
  return (
    within(profile.sum, b.sum) &&
    within(profile.odds, b.odds) &&
    within(profile.primes, b.primes) &&
    within(profile.frame, b.frame) &&
    within(repeats, b.repeats)
  );
}

/** Amostragem ponderada sem reposição (Efraimidis–Spirakis). */
export function weightedSample(weights: number[], k: number, rng: () => number): number[] {
  return weights
    .map((w, i) => ({ i, key: Math.pow(rng(), 1 / Math.max(w, 1e-9)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, k)
    .map((x) => x.i);
}

export function suggestGames(draws: Draw[], options: StrategyOptions = {}): StrategyResult {
  if (draws.length < 30) throw new Error('Histórico insuficiente: sincronize os resultados primeiro.');
  const betSize = options.betSize ?? DRAWN_PER_CONTEST;
  if (betSize < MIN_BET_SIZE || betSize > MAX_BET_SIZE) {
    throw new RangeError(`betSize deve estar entre ${MIN_BET_SIZE} e ${MAX_BET_SIZE}`);
  }
  const gamesWanted = Math.max(1, Math.min(options.games ?? 1, 50));
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const rng = createRng(options.seed ?? draws[draws.length - 1].concurso);
  const candidateCount = options.candidates ?? 20000;
  const maxOverlap = options.maxOverlap ?? Math.max(betSize - 4, 9);

  const { scores, analogs } = computeNumberScores(
    draws,
    weights,
    options.recentWindow,
    options.analogNeighbors,
  );
  const bounds = computeProfileBounds(draws);
  const embeddings = numberEmbeddings(cooccurrenceMatrix(draws), draws.length);
  const lastNumbers = new Set(draws[draws.length - 1].numbers);

  // Converte score em peso de amostragem (softmax suave).
  const samplingWeights = scores.map((s) => Math.exp(0.8 * s.score));
  const scoreByNumber = new Map(scores.map((s) => [s.number, s.score]));

  const seen = new Set<string>();
  const fitting: SuggestedGame[] = [];
  const outOfProfile: SuggestedGame[] = [];
  for (let i = 0; i < candidateCount; i++) {
    const numbers = sortAsc(weightedSample(samplingWeights, betSize, rng).map((idx) => idx + 1));
    const key = numbers.join('-');
    if (seen.has(key)) continue;
    seen.add(key);
    const profile = gameProfile(numbers);
    const repeatsFromLast = numbers.filter((n) => lastNumbers.has(n)).length;
    const cohesion = gameCohesion(numbers, embeddings);
    const meanScore = numbers.reduce((acc, n) => acc + (scoreByNumber.get(n) ?? 0), 0) / betSize;
    const candidate = { numbers, score: meanScore + weights.cohesion * cohesion, cohesion, profile, repeatsFromLast };
    // Os filtros de perfil só fazem sentido para jogos de 15 dezenas (mesmo tamanho do sorteio).
    const fits = betSize !== DRAWN_PER_CONTEST || fitsProfile(profile, repeatsFromLast, bounds);
    (fits ? fitting : outOfProfile).push(candidate);
  }
  const byScore = (a: SuggestedGame, b: SuggestedGame) => b.score - a.score;
  // Fora do perfil só entram como reserva, garantindo que sempre haja jogos suficientes.
  const candidates = [...fitting.sort(byScore), ...outOfProfile.sort(byScore)];

  // Seleção gulosa com diversidade; relaxa a sobreposição se não houver candidatos suficientes.
  let games: SuggestedGame[] = [];
  for (let overlap = maxOverlap; overlap <= betSize && games.length < gamesWanted; overlap++) {
    games = [];
    for (const candidate of candidates) {
      const set = new Set(candidate.numbers);
      const tooSimilar = games.some((g) => g.numbers.filter((n) => set.has(n)).length > overlap);
      if (!tooSimilar) games.push(candidate);
      if (games.length === gamesWanted) break;
    }
  }

  return {
    basedOnConcurso: draws[draws.length - 1].concurso,
    betSize,
    games,
    numberScores: [...scores].sort((a, b) => b.score - a.score),
    profileBounds: bounds,
    analogConcursos: analogs.map((a) => ({ concurso: draws[a.index].concurso, similarity: a.similarity })),
  };
}
