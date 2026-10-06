import { Draw } from '../common/lottery';
import { BacktestResult, runBacktest } from '../backtest/backtest.engine';
import { runCheck } from '../check/check.engine';
import { BetPlan, multipleGamesAtLeast14, planBudget, planOdds, PlanOdds } from '../strategy/bet-planner';
import { averagePrizes, planReturns, PlanReturns } from '../strategy/returns';
import { StrategyResult, StrategyWeights, suggestGames, SuggestedGame } from '../strategy/strategy.engine';

/**
 * Tarefas de CPU pesada (puras e serializáveis), executadas num worker thread para não travar o
 * event loop da API. Também podem rodar inline (testes / ts-node).
 */
export interface PlanWithGames extends BetPlan {
  games: SuggestedGame[];
  odds: PlanOdds;
  returns: PlanReturns;
}

export interface PlanResult {
  budget: number;
  betPrice: number;
  basedOnConcurso: number;
  rationale: string;
  recommended: PlanWithGames | null;
  plans: PlanWithGames[];
}

const PRIZE_WINDOW = 50;

export interface SuggestArgs {
  betSize: number;
  games: number;
  seed?: number;
  weights?: Partial<StrategyWeights>;
}

export interface PlanArgs {
  budget: number;
  betPrice: number;
  weights?: Partial<StrategyWeights>;
}

export interface BacktestArgs {
  betSize: number;
  testSize: number;
  budget?: number;
  betPrice: number;
  weights?: Partial<StrategyWeights>;
}

export function suggestTask(draws: Draw[], args: SuggestArgs): StrategyResult {
  return suggestGames(draws, args);
}

/** Recomenda quantas dezenas comprar para o orçamento e já gera os números de cada opção. */
export function planTask(draws: Draw[], { budget, betPrice, weights }: PlanArgs): PlanResult {
  const recommendation = planBudget(budget, betPrice);
  const prizes = averagePrizes(draws, PRIZE_WINDOW);

  const plans: PlanWithGames[] = recommendation.plans.map((plan) => {
    const multiple = plan.kind === 'multiple-games';
    const { games } = suggestGames(draws, {
      betSize: plan.betSize,
      games: plan.tickets,
      weights,
      // Sobreposição <= 12 torna os eventos "14+" disjuntos: chance total = soma exata.
      maxOverlap: multiple ? 11 : undefined,
      candidates: multiple ? Math.max(20000, plan.tickets * 1500) : 20000,
    });
    const odds = planOdds(games.map((g) => g.numbers), plan.betSize);
    const cost = multiple ? Number((games.length * betPrice).toFixed(2)) : plan.cost;
    const returns = planReturns(plan.betSize, games.length, cost, prizes, PRIZE_WINDOW);
    if (!multiple) return { ...plan, games, odds, returns };
    const prob = multipleGamesAtLeast14(games.map((g) => g.numbers));
    return { ...plan, tickets: games.length, cost, probAtLeast14: prob, oneIn: Math.round(1 / prob.estimate), games, odds, returns };
  });

  const recommended = plans.reduce<PlanWithGames | null>(
    (best, p) => (!best || p.probAtLeast14.lower > best.probAtLeast14.lower ? p : best),
    null,
  );
  return {
    budget: recommendation.budget,
    betPrice: recommendation.betPrice,
    basedOnConcurso: draws[draws.length - 1].concurso,
    rationale: recommendation.rationale,
    recommended,
    plans,
  };
}

export function backtestTask(draws: Draw[], args: BacktestArgs): BacktestResult {
  return runBacktest(draws, args);
}

export const TASKS = {
  suggest: suggestTask,
  plan: planTask,
  backtest: backtestTask,
  check: runCheck,
};

export type TaskName = keyof typeof TASKS;
export type TaskArgs<K extends TaskName> = Parameters<(typeof TASKS)[K]>[1];
export type TaskResult<K extends TaskName> = ReturnType<(typeof TASKS)[K]>;
