import { allNumbers, createRng, Draw, LotteryGame, maskOverlap, sortAsc, toMask } from '../common/lottery';
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
  game: LotteryGame,
  draws: Draw[],
  weights: StrategyWeights = DEFAULT_WEIGHTS,
  recentWindow = game.recentWindow,
  analogNeighbors = 30,
): { scores: NumberScore[]; analogs: Array<{ index: number; similarity: number }> } {
  const stats = numberStats(game, draws, recentWindow);

  const momentumRaw = new Array<number>(game.totalNumbers).fill(0);
  const decay = Math.pow(0.5, 1 / game.momentumHalfLife);
  let w = 1;
  for (let i = draws.length - 1; i >= 0 && w > 1e-4; i--) {
    for (const n of draws[i].numbers) momentumRaw[n - 1] += w;
    w *= decay;
  }

  // Previsão por análogos: vizinhos do último concurso (excluindo ele mesmo) e seus sucessores.
  const analogRaw = new Array<number>(game.totalNumbers).fill(0);
  let analogs: Array<{ index: number; similarity: number }> = [];
  if (draws.length > 2) {
    const vectors = draws.map((d) => drawEmbedding(game, d.numbers));
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

  const scores = allNumbers(game).map((number, i) => {
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

export function computeProfileBounds(game: LotteryGame, draws: Draw[]): ProfileBounds {
  const profiles = draws.map((d) => gameProfile(game, d.numbers));
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

export function suggestGames(game: LotteryGame, draws: Draw[], options: StrategyOptions = {}): StrategyResult {
  if (draws.length < 30) throw new Error('Histórico insuficiente: sincronize os resultados primeiro.');
  const betSize = options.betSize ?? game.drawn;
  if (!Number.isInteger(betSize) || betSize < game.minBet || betSize > game.maxBet) {
    throw new RangeError(`betSize deve estar entre ${game.minBet} e ${game.maxBet} na ${game.name}`);
  }
  const gamesWanted = Math.max(1, Math.min(options.games ?? 1, 50));
  const weights = { ...DEFAULT_WEIGHTS, ...options.weights };
  const rng = createRng(options.seed ?? draws[draws.length - 1].concurso);
  const candidateCount = options.candidates ?? 20000;

  const { scores, analogs } = computeNumberScores(
    game,
    draws,
    weights,
    options.recentWindow,
    options.analogNeighbors,
  );
  const bounds = computeProfileBounds(game, draws);
  const embeddings = numberEmbeddings(cooccurrenceMatrix(game, draws), draws.length);
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
    const profile = gameProfile(game, numbers);
    const repeatsFromLast = numbers.filter((n) => lastNumbers.has(n)).length;
    const cohesion = gameCohesion(numbers, embeddings);
    const meanScore = numbers.reduce((acc, n) => acc + (scoreByNumber.get(n) ?? 0), 0) / betSize;
    const candidate = { numbers, score: meanScore + weights.cohesion * cohesion, cohesion, profile, repeatsFromLast };
    // Os filtros de perfil só fazem sentido para jogos do mesmo tamanho do sorteio.
    const fits = betSize !== game.drawn || fitsProfile(profile, repeatsFromLast, bounds);
    (fits ? fitting : outOfProfile).push(candidate);
  }
  const byScore = (a: SuggestedGame, b: SuggestedGame) => b.score - a.score;
  // Fora do perfil só entram como reserva, garantindo que sempre haja jogos suficientes.
  fitting.sort(byScore);
  const candidates = fitting.length >= gamesWanted ? fitting : [...fitting, ...outOfProfile.sort(byScore)];

  return {
    basedOnConcurso: draws[draws.length - 1].concurso,
    betSize,
    games: selectSpread(candidates, gamesWanted),
    numberScores: [...scores].sort((a, b) => b.score - a.score),
    profileBounds: bounds,
    analogConcursos: analogs.map((a) => ({ concurso: draws[a.index].concurso, similarity: a.similarity })),
  };
}

/**
 * Seleção gulosa de máxima dispersão: cada novo jogo é o candidato com a menor sobreposição máxima
 * (e depois a menor soma de sobreposições) com os já escolhidos; o score só desempata. Com vários
 * jogos, é a sobreposição baixa — não o score — que aumenta a chance de pelo menos um premiado.
 * `candidates` vem ordenado por preferência (melhor primeiro).
 */
export function selectSpread(candidates: SuggestedGame[], wanted: number): SuggestedGame[] {
  const masks = candidates.map((c) => toMask(c.numbers));
  const maxOv = new Array<number>(candidates.length).fill(0);
  const sumOv = new Array<number>(candidates.length).fill(0);
  const used = new Array<boolean>(candidates.length).fill(false);
  const games: SuggestedGame[] = [];
  while (games.length < Math.min(wanted, candidates.length)) {
    let best = -1;
    for (let i = 0; i < candidates.length; i++) {
      if (used[i]) continue;
      if (best < 0 || maxOv[i] < maxOv[best] || (maxOv[i] === maxOv[best] && sumOv[i] < sumOv[best])) best = i;
    }
    used[best] = true;
    games.push(candidates[best]);
    for (let i = 0; i < candidates.length; i++) {
      if (used[i]) continue;
      const ov = maskOverlap(masks[i], masks[best]);
      sumOv[i] += ov;
      if (ov > maxOv[i]) maxOv[i] = ov;
    }
  }
  return games;
}
