import { binomial, DRAWN_PER_CONTEST, MAX_BET_SIZE, MIN_BET_SIZE, TOTAL_NUMBERS } from '../common/lottery';
import { betProbability, TOTAL_COMBINATIONS } from './probability';

/**
 * Planejador: dado um orçamento, compara as formas de gastá-lo e recomenda a de maior chance de
 * obter pelo menos 14 acertos. O usuário decide — o app só mostra os números.
 */
export type PlanKind = 'single-bet' | 'multiple-games';

export interface BetPlan {
  kind: PlanKind;
  betSize: number;
  /** Quantidade de cartões (apostas) no plano. */
  tickets: number;
  cost: number;
  /** P(pelo menos um cartão com >= 14 acertos). Para vários jogos é um intervalo [lower, upper]. */
  probAtLeast14: { lower: number; upper: number; estimate: number };
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

/** P(jogo de 15 dezenas faz >= threshold). */
function singleAtLeast(threshold: number): number {
  let total = 0;
  for (let k = threshold; k <= DRAWN_PER_CONTEST; k++) {
    total += binomial(DRAWN_PER_CONTEST, k) * binomial(TOTAL_NUMBERS - DRAWN_PER_CONTEST, DRAWN_PER_CONTEST - k);
  }
  return total / TOTAL_COMBINATIONS;
}

/**
 * P(dois jogos de 15 dezenas, com `overlap` dezenas em comum, fazerem AMBOS >= threshold).
 * Enumeração exata sobre as quatro regiões do volante: A∩B, A\B, B\A e fora de ambos.
 */
export function jointAtLeast(overlap: number, threshold = 14): number {
  const both = overlap;
  const onlyA = DRAWN_PER_CONTEST - overlap;
  const onlyB = DRAWN_PER_CONTEST - overlap;
  const none = TOTAL_NUMBERS - both - onlyA - onlyB;
  if (none < 0) throw new RangeError('Sobreposição impossível para jogos de 15 dezenas (mínimo 5).');
  let count = 0;
  for (let a = 0; a <= both; a++) {
    for (let b = 0; b <= onlyA; b++) {
      for (let c = 0; c <= onlyB; c++) {
        const d = DRAWN_PER_CONTEST - a - b - c;
        if (d < 0 || d > none) continue;
        if (a + b < threshold || a + c < threshold) continue;
        count += binomial(both, a) * binomial(onlyA, b) * binomial(onlyB, c) * binomial(none, d);
      }
    }
  }
  return count / TOTAL_COMBINATIONS;
}

/**
 * P(pelo menos um de vários jogos de 15 dezenas fazer >= 14), limitada por Bonferroni:
 *   Σ P(Ai) − Σ P(Ai ∩ Aj)  <=  P(∪Ai)  <=  Σ P(Ai)
 */
export function multipleGamesAtLeast14(games: number[][]): { lower: number; upper: number; estimate: number } {
  const single = singleAtLeast(14);
  const upper = Math.min(1, games.length * single);
  let pairwise = 0;
  for (let i = 0; i < games.length; i++) {
    const set = new Set(games[i]);
    for (let j = i + 1; j < games.length; j++) {
      const overlap = games[j].filter((n) => set.has(n)).length;
      pairwise += jointAtLeast(overlap, 14);
    }
  }
  const lower = Math.max(0, upper - pairwise);
  return { lower, upper, estimate: (lower + upper) / 2 };
}

/**
 * Estimativa para k jogos "bem espalhados" antes de gerá-los: assume sobreposição típica de 9
 * dezenas entre pares (média de dois jogos aleatórios = 15*15/25 = 9).
 */
export function estimateMultipleGames(k: number, typicalOverlap = 9) {
  const single = singleAtLeast(14);
  const upper = Math.min(1, k * single);
  const pairs = (k * (k - 1)) / 2;
  const lower = Math.max(0, upper - pairs * jointAtLeast(typicalOverlap, 14));
  return { lower, upper, estimate: (lower + upper) / 2 };
}

export function planBudget(budget: number, betPrice: number, maxGames = 50): PlanRecommendation {
  const plans: BetPlan[] = [];
  for (let size = MIN_BET_SIZE; size <= MAX_BET_SIZE; size++) {
    const p = betProbability(size, betPrice);
    if (p.cost > budget + 1e-9) break;
    plans.push({
      kind: 'single-bet',
      betSize: size,
      tickets: 1,
      cost: p.cost,
      probAtLeast14: { lower: p.atLeast14, upper: p.atLeast14, estimate: p.atLeast14 },
      oneIn: p.atLeast14OneIn,
      description: `1 aposta de ${size} dezenas (${p.combinations} combinações de 15)`,
    });
  }
  const k = Math.min(maxGames, Math.floor((budget + 1e-9) / betPrice));
  if (k >= 2) {
    const prob = estimateMultipleGames(k);
    plans.push({
      kind: 'multiple-games',
      betSize: DRAWN_PER_CONTEST,
      tickets: k,
      cost: Number((k * betPrice).toFixed(2)),
      probAtLeast14: prob,
      oneIn: Math.round(1 / prob.estimate),
      description: `${k} jogos diferentes de 15 dezenas, com pouca sobreposição entre si`,
    });
  }

  const recommended = plans.reduce<BetPlan | null>(
    (best, p) => (!best || p.probAtLeast14.lower > best.probAtLeast14.lower ? p : best),
    null,
  );

  let rationale: string;
  if (!recommended) {
    rationale = `Orçamento insuficiente: uma aposta simples custa R$ ${betPrice.toFixed(2)}.`;
  } else if (recommended.kind === 'multiple-games') {
    rationale =
      'Pelo mesmo valor, jogos de 15 dezenas espalhados cobrem mais combinações distintas do volante ' +
      'que uma aposta grande (cujas combinações internas se sobrepõem muito), então a chance de pelo ' +
      'menos um 14+ é maior. Em contrapartida, uma aposta grande paga vários prêmios de uma vez quando acerta.';
  } else {
    rationale =
      recommended.betSize === DRAWN_PER_CONTEST
        ? 'Com esse orçamento, a opção é uma aposta simples de 15 dezenas.'
        : `A aposta de ${recommended.betSize} dezenas é a de maior chance dentro do orçamento.`;
  }
  return { budget, betPrice, plans, recommended, rationale };
}
