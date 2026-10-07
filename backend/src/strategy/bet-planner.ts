import { binomial, createRng, LotteryGame, Mask, maskOverlap, toMask, totalCombinations } from '../common/lottery';
import { atLeastProbability, betProbability } from './probability';

/**
 * Planejador: dado um orçamento, compara as formas de gastá-lo e recomenda a de maior chance de
 * atingir a faixa "quase máxima" (14+ na Lotofácil, 5+ na Mega-Sena, 4+ na Quina).
 * O usuário decide — o app só mostra os números.
 */
export type PlanKind = 'single-bet' | 'multiple-games';

export interface Bounds {
  lower: number;
  upper: number;
  estimate: number;
}

export interface BetPlan {
  kind: PlanKind;
  betSize: number;
  /** Quantidade de cartões (apostas) no plano. */
  tickets: number;
  cost: number;
  /** P(pelo menos um cartão na faixa quase máxima). Para vários jogos é um intervalo [lower, upper]. */
  probAtLeastNear: Bounds;
  oneIn: number;
  description: string;
}

export interface PlanRecommendation {
  budget: number;
  betPrice: number;
  plans: BetPlan[];
  recommended: BetPlan | null;
  rationale: string;
}

/**
 * P(dois jogos simples, com `overlap` dezenas em comum, fazerem AMBOS >= threshold).
 * Enumeração exata sobre as quatro regiões do volante: A∩B, A\B, B\A e fora de ambos.
 */
export function jointAtLeast(game: LotteryGame, overlap: number, threshold = game.nearHits): number {
  const d = game.drawn;
  const both = overlap;
  const onlyA = d - overlap;
  const onlyB = d - overlap;
  const none = game.totalNumbers - both - onlyA - onlyB;
  if (none < 0 || overlap < 0 || overlap > d) throw new RangeError(`Sobreposição impossível: ${overlap}`);
  let count = 0;
  for (let a = 0; a <= both; a++) {
    for (let b = 0; b <= onlyA; b++) {
      for (let c = 0; c <= onlyB; c++) {
        const rest = d - a - b - c;
        if (rest < 0 || rest > none) continue;
        if (a + b < threshold || a + c < threshold) continue;
        count += binomial(both, a) * binomial(onlyA, b) * binomial(onlyB, c) * binomial(none, rest);
      }
    }
  }
  return count / totalCombinations(game);
}

/**
 * P(pelo menos um de vários jogos simples fazer >= threshold), limitada por Bonferroni:
 *   Σ P(Ai) − Σ P(Ai ∩ Aj)  <=  P(∪Ai)  <=  Σ P(Ai)
 * Exata quando nenhum par pode atingir a faixa ao mesmo tempo (sobreposição baixa).
 */
export function multipleGamesAtLeast(game: LotteryGame, games: number[][], threshold = game.nearHits): Bounds {
  const single = atLeastProbability(game, game.drawn, threshold);
  const upper = Math.min(1, games.length * single);
  const masks = games.map(toMask);
  const jointByOverlap = new Map<number, number>();
  let pairwise = 0;
  for (let i = 0; i < games.length; i++) {
    for (let j = i + 1; j < games.length; j++) {
      const overlap = maskOverlap(masks[i], masks[j]);
      if (!jointByOverlap.has(overlap)) jointByOverlap.set(overlap, jointAtLeast(game, overlap, threshold));
      pairwise += jointByOverlap.get(overlap)!;
    }
  }
  const lower = Math.max(0, upper - pairwise);
  return { lower, upper, estimate: (lower + upper) / 2 };
}

/**
 * Estimativa para k jogos "bem espalhados" antes de gerá-los: assume a sobreposição média de dois
 * jogos aleatórios (d²/N, arredondada).
 */
export function estimateMultipleGames(game: LotteryGame, k: number): Bounds {
  const single = atLeastProbability(game, game.drawn, game.nearHits);
  const upper = Math.min(1, k * single);
  const pairs = (k * (k - 1)) / 2;
  const typicalOverlap = Math.round((game.drawn * game.drawn) / game.totalNumbers);
  const lower = Math.max(0, upper - pairs * jointAtLeast(game, typicalOverlap, game.nearHits));
  return { lower, upper, estimate: (lower + upper) / 2 };
}

/** P(pelo menos um cartão com >= `hits` acertos), para cada faixa premiada (ordem crescente). */
export interface PlanOdds {
  tiers: Array<{ hits: number; probability: number }>;
}

/** Abaixo disso, o limite inferior de Bonferroni é praticamente exato (erro <= Σ²/2). */
const BONFERRONI_MAX_SUM = 0.05;

/**
 * Aposta única: hipergeométrica exata.
 * Vários jogos simples: prêmio máximo exato (jogos distintos são eventos disjuntos); faixas raras
 * por Bonferroni (exato com sobreposição baixa); faixas comuns por Monte Carlo.
 */
export function planOdds(game: LotteryGame, games: number[][], betSize: number, simulations = 100_000, seed = 1): PlanOdds {
  if (games.length <= 1) {
    return { tiers: game.prizeHits.map((hits) => ({ hits, probability: atLeastProbability(game, betSize, hits) })) };
  }
  const exact = new Map<number, number>();
  const needMonteCarlo: number[] = [];
  const distinct = new Set(games.map((g) => [...g].sort((a, b) => a - b).join('-'))).size;
  for (const hits of game.prizeHits) {
    if (hits === game.drawn) exact.set(hits, Math.min(1, distinct / totalCombinations(game)));
    else {
      const bounds = multipleGamesAtLeast(game, games, hits);
      if (hits >= game.nearHits || bounds.upper <= BONFERRONI_MAX_SUM) exact.set(hits, bounds.lower);
      else needMonteCarlo.push(hits);
    }
  }
  if (needMonteCarlo.length) {
    const counts = monteCarloBest(game, games, simulations, seed);
    for (const hits of needMonteCarlo) {
      let n = 0;
      for (let best = hits; best <= game.drawn; best++) n += counts[best];
      exact.set(hits, n / simulations);
    }
  }
  return { tiers: game.prizeHits.map((hits) => ({ hits, probability: exact.get(hits)! })) };
}

/** Histograma do melhor resultado entre os cartões em `simulations` sorteios simulados. */
function monteCarloBest(game: LotteryGame, games: number[][], simulations: number, seed: number): number[] {
  const rng = createRng(seed);
  const masks = games.map(toMask);
  const counts = new Array<number>(game.drawn + 1).fill(0);
  const pool = Array.from({ length: game.totalNumbers }, (_, i) => i + 1);
  const drawnMask: Mask = [0, 0, 0];
  for (let s = 0; s < simulations; s++) {
    // Fisher–Yates parcial: `drawn` dezenas sorteadas (máscara montada no lugar, sem alocar por simulação).
    drawnMask[0] = drawnMask[1] = drawnMask[2] = 0;
    for (let i = 0; i < game.drawn; i++) {
      const j = i + Math.floor(rng() * (game.totalNumbers - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      drawnMask[(pool[i] - 1) >>> 5] |= 1 << ((pool[i] - 1) & 31);
    }
    let best = 0;
    for (const m of masks) best = Math.max(best, maskOverlap(m, drawnMask));
    counts[best]++;
  }
  return counts;
}

export function planBudget(game: LotteryGame, budget: number, betPrice: number, maxGames = 50): PlanRecommendation {
  const near = `${game.nearHits}+`;
  const plans: BetPlan[] = [];
  for (let size = game.minBet; size <= game.maxBet; size++) {
    const p = betProbability(game, size, betPrice);
    if (p.cost > budget + 1e-9) break;
    plans.push({
      kind: 'single-bet',
      betSize: size,
      tickets: 1,
      cost: p.cost,
      probAtLeastNear: { lower: p.atLeastNear, upper: p.atLeastNear, estimate: p.atLeastNear },
      oneIn: p.atLeastNearOneIn,
      description: `1 aposta de ${size} dezenas (${p.combinations} combinações de ${game.drawn})`,
    });
  }
  const k = Math.min(maxGames, Math.floor((budget + 1e-9) / betPrice));
  if (k >= 2) {
    const prob = estimateMultipleGames(game, k);
    plans.push({
      kind: 'multiple-games',
      betSize: game.drawn,
      tickets: k,
      cost: Number((k * betPrice).toFixed(2)),
      probAtLeastNear: prob,
      oneIn: Math.round(1 / prob.estimate),
      description: `${k} jogos diferentes de ${game.drawn} dezenas, com pouca sobreposição entre si`,
    });
  }

  const recommended = plans.reduce<BetPlan | null>(
    (best, p) => (!best || p.probAtLeastNear.lower > best.probAtLeastNear.lower ? p : best),
    null,
  );

  let rationale: string;
  if (!recommended) {
    rationale = `Orçamento insuficiente: uma aposta simples custa R$ ${betPrice.toFixed(2)}.`;
  } else if (recommended.kind === 'multiple-games') {
    rationale =
      `Pelo mesmo valor, jogos de ${game.drawn} dezenas espalhados cobrem mais combinações distintas do volante ` +
      'que uma aposta grande (cujas combinações internas se sobrepõem muito), então a chance de pelo ' +
      `menos um ${near} é maior. Em contrapartida, uma aposta grande paga vários prêmios de uma vez quando acerta.`;
  } else {
    rationale =
      recommended.betSize === game.drawn
        ? `Com esse orçamento, a opção é uma aposta simples de ${game.drawn} dezenas.`
        : `A aposta de ${recommended.betSize} dezenas é a de maior chance dentro do orçamento.`;
  }
  return { budget, betPrice, plans, recommended, rationale };
}
