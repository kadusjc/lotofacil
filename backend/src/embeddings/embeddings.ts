import { TOTAL_NUMBERS, DRAWN_PER_CONTEST } from '../common/lottery';
import { gameProfile } from '../statistics/statistics';

/**
 * Embeddings numéricos (sem dependência de APIs externas):
 *  - Concurso → vetor de 31 dimensões: 25 one-hot centrados + 6 features de perfil normalizadas.
 *    O cosseno entre dois concursos aproxima a correlação de Pearson das dezenas + similaridade de perfil.
 *  - Dezena → vetor latente obtido de PPMI (Positive Pointwise Mutual Information) da matriz de
 *    coocorrência, fatorada por decomposição espectral (power iteration + deflação), como no word2vec/GloVe.
 */
export const DRAW_EMBEDDING_DIMENSIONS = 31;

const ONE_HOT_MEAN = DRAWN_PER_CONTEST / TOTAL_NUMBERS; // 0.6
const PROFILE_WEIGHT = 0.5;
// [média esperada, meia-amplitude] de cada feature de perfil para normalização ~[-1, 1]
const PROFILE_NORMALIZATION: Array<[keyof ReturnType<typeof gameProfile>, number, number]> = [
  ['sum', 195, 60],
  ['odds', 7.8, 4],
  ['primes', 5.4, 4],
  ['frame', 9.6, 4],
  ['fibonacci', 4.2, 3],
  ['maxRun', 4.5, 4],
];

export function drawEmbedding(numbers: number[]): number[] {
  const set = new Set(numbers);
  const vec: number[] = [];
  for (let n = 1; n <= TOTAL_NUMBERS; n++) vec.push((set.has(n) ? 1 : 0) - ONE_HOT_MEAN);
  const profile = gameProfile(numbers);
  for (const [key, mean, halfRange] of PROFILE_NORMALIZATION) {
    vec.push(PROFILE_WEIGHT * clamp((profile[key] - mean) / halfRange, -1.5, 1.5));
  }
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

export interface Neighbor {
  index: number;
  similarity: number;
}

/** k vizinhos mais próximos por cosseno (força bruta — trivial para ~4k vetores). */
export function nearestNeighbors(
  query: number[],
  vectors: number[][],
  k: number,
  exclude: Set<number> = new Set(),
): Neighbor[] {
  return vectors
    .map((v, index) => ({ index, similarity: cosineSimilarity(query, v) }))
    .filter((n) => !exclude.has(n.index))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

/** PPMI a partir da matriz de coocorrência (diagonal = frequência individual). */
export function ppmiMatrix(cooc: number[][], totalDraws: number): number[][] {
  const n = cooc.length;
  const m = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  if (!totalDraws) return m;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const pij = cooc[i][j] / totalDraws;
      const pi = cooc[i][i] / totalDraws;
      const pj = cooc[j][j] / totalDraws;
      if (pij > 0 && pi > 0 && pj > 0) m[i][j] = Math.max(0, Math.log(pij / (pi * pj)));
    }
  }
  return m;
}

/** Autovetores dominantes de matriz simétrica por power iteration com deflação. */
export function topEigen(
  matrix: number[][],
  k: number,
  iterations = 200,
): { values: number[]; vectors: number[][] } {
  const n = matrix.length;
  const a = matrix.map((row) => [...row]);
  const values: number[] = [];
  const vectors: number[][] = [];
  for (let c = 0; c < k; c++) {
    // vetor inicial determinístico
    let v = Array.from({ length: n }, (_, i) => 1 + ((i * 7919 + c * 104729) % 13) / 13);
    v = normalize(v);
    let lambda = 0;
    for (let it = 0; it < iterations; it++) {
      const w = multiply(a, v);
      const norm = Math.hypot(...w);
      if (norm === 0) break;
      v = w.map((x) => x / norm);
      lambda = dot(v, multiply(a, v));
    }
    values.push(lambda);
    vectors.push(v);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) a[i][j] -= lambda * v[i] * v[j];
  }
  return { values, vectors };
}

/** Embedding de cada dezena (índice 0 = dezena 1), dimensão `dims`. */
export function numberEmbeddings(cooc: number[][], totalDraws: number, dims = 8): number[][] {
  const ppmi = ppmiMatrix(cooc, totalDraws);
  const { values, vectors } = topEigen(ppmi, dims);
  return ppmi.map((_, i) => vectors.map((vec, d) => vec[i] * Math.sqrt(Math.max(values[d], 0))));
}

/** Coesão média de um jogo: média do cosseno entre os embeddings de todos os pares. */
export function gameCohesion(game: number[], embeddings: number[][]): number {
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < game.length; i++) {
    for (let j = i + 1; j < game.length; j++) {
      total += cosineSimilarity(embeddings[game[i] - 1], embeddings[game[j] - 1]);
      pairs++;
    }
  }
  return pairs ? total / pairs : 0;
}

function multiply(m: number[][], v: number[]): number[] {
  return m.map((row) => dot(row, v));
}

function dot(a: number[], b: number[]): number {
  return a.reduce((acc, x, i) => acc + x * b[i], 0);
}

function normalize(v: number[]): number[] {
  const norm = Math.hypot(...v);
  return norm ? v.map((x) => x / norm) : v;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
