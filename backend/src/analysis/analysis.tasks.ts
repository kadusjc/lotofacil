import { Draw, GameId, GAMES } from '../common/lottery';
import { BacktestResult, runBacktest } from '../backtest/backtest.engine';
import { CheckArgs, CheckResult, runCheck } from '../check/check.engine';
import { BetPlan, multipleGamesAtLeast, planBudget, planOdds, PlanOdds } from '../strategy/bet-planner';
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
  betSize?: number;
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
  betSize?: number;
  testSize: number;
  budget?: number;
  betPrice: number;
  weights?: Partial<StrategyWeights>;
}

export function suggestTask(gameId: GameId, draws: Draw[], args: SuggestArgs): StrategyResult {
  return suggestGames(GAMES[gameId], draws, args);
}

/** Recomenda quantas dezenas comprar para o orçamento e já gera os números de cada opção. */
export function planTask(gameId: GameId, draws: Draw[], { budget, betPrice, weights }: PlanArgs): PlanResult {
  const game = GAMES[gameId];
  const recommendation = planBudget(game, budget, betPrice);
  const prizes = averagePrizes(game, draws, PRIZE_WINDOW);

  const plans: PlanWithGames[] = recommendation.plans.map((plan) => {
    const multiple = plan.kind === 'multiple-games';
    const { games } = suggestGames(game, draws, {
      betSize: plan.betSize,
      games: plan.tickets,
      weights,
      candidates: multiple ? Math.max(20000, plan.tickets * 1500) : 20000,
    });
    const numbers = games.map((g) => g.numbers);
    const odds = planOdds(game, numbers, plan.betSize);
    const cost = multiple ? Number((games.length * betPrice).toFixed(2)) : plan.cost;
    const returns = planReturns(game, plan.betSize, games.length, cost, prizes, PRIZE_WINDOW);
    if (!multiple) return { ...plan, games, odds, returns };
    const prob = multipleGamesAtLeast(game, numbers);
    return { ...plan, tickets: games.length, cost, probAtLeastNear: prob, oneIn: Math.round(1 / prob.estimate), games, odds, returns };
  });

  const recommended = plans.reduce<PlanWithGames | null>(
    (best, p) => (!best || p.probAtLeastNear.lower > best.probAtLeastNear.lower ? p : best),
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

export function backtestTask(gameId: GameId, draws: Draw[], args: BacktestArgs): BacktestResult {
  return runBacktest(GAMES[gameId], draws, args);
}

export function checkTask(gameId: GameId, draws: Draw[], args: CheckArgs): CheckResult {
  return runCheck(GAMES[gameId], draws, args);
}

/** Tarefas recebem o id do jogo (serializável) para rodar no worker. */
export const TASKS = {
  suggest: suggestTask,
  plan: planTask,
  backtest: backtestTask,
  check: checkTask,
};

export type TaskName = keyof typeof TASKS;
export type TaskArgs<K extends TaskName> = Parameters<(typeof TASKS)[K]>[2];
export type TaskResult<K extends TaskName> = ReturnType<(typeof TASKS)[K]>;
