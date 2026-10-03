import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Draw } from '../common/lottery';
import { AppConfig } from '../config/configuration';
import { DrawsService } from '../draws/draws.service';
import { runBacktest } from '../backtest/backtest.engine';
import { multipleGamesAtLeast14, planBudget, planOdds, BetPlan, PlanOdds } from '../strategy/bet-planner';
import { probabilityTable } from '../strategy/probability';
import { averagePrizes, planReturns, PlanReturns } from '../strategy/returns';
import { StrategyWeights, suggestGames, SuggestedGame } from '../strategy/strategy.engine';
import {
  distribution,
  gameProfile,
  numberStats,
  rangeStat,
  repeatsFromPrevious,
  uniformityTest,
} from '../statistics/statistics';
import { BacktestDto, PlanDto, SuggestDto } from './analysis.dto';

export interface PlanWithGames extends BetPlan {
  games: SuggestedGame[];
  odds: PlanOdds;
  returns: PlanReturns;
}

const PRIZE_WINDOW = 50;

@Injectable()
export class AnalysisService {
  constructor(
    private readonly draws: DrawsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private get betPrice(): number {
    return this.config.get('betPrice', { infer: true });
  }

  async summary() {
    const draws = await this.requireDraws();
    const profiles = draws.map((d) => gameProfile(d.numbers));
    const repeats = repeatsFromPrevious(draws);
    const sumBuckets = profiles.map((p) => Math.floor(p.sum / 10) * 10);
    return {
      totalDraws: draws.length,
      first: { concurso: draws[0].concurso, date: draws[0].date },
      last: draws[draws.length - 1],
      numbers: numberStats(draws, 25),
      profiles: {
        sum: { ...rangeStat(profiles.map((p) => p.sum)), distribution: distribution(sumBuckets) },
        odds: { ...rangeStat(profiles.map((p) => p.odds)), distribution: distribution(profiles.map((p) => p.odds)) },
        primes: { ...rangeStat(profiles.map((p) => p.primes)), distribution: distribution(profiles.map((p) => p.primes)) },
        frame: { ...rangeStat(profiles.map((p) => p.frame)), distribution: distribution(profiles.map((p) => p.frame)) },
        repeats: { ...rangeStat(repeats), distribution: distribution(repeats) },
      },
      uniformity: uniformityTest(draws),
    };
  }

  probabilities() {
    return { betPrice: this.betPrice, rows: probabilityTable(this.betPrice) };
  }

  async suggest(dto: SuggestDto) {
    const draws = await this.requireDraws();
    return suggestGames(draws, {
      betSize: dto.betSize,
      games: dto.games,
      seed: dto.seed,
      weights: dto.weights as Partial<StrategyWeights>,
    });
  }

  /** Recomenda quantas dezenas comprar para o orçamento e já gera os números de cada opção. */
  async plan(dto: PlanDto) {
    const draws = await this.requireDraws();
    const recommendation = planBudget(dto.budget, this.betPrice);
    const weights = dto.weights as Partial<StrategyWeights>;
    const prizes = averagePrizes(draws, PRIZE_WINDOW);

    const plans: PlanWithGames[] = recommendation.plans.map((plan) => {
      const { games } = suggestGames(draws, {
        betSize: plan.betSize,
        games: plan.tickets,
        weights,
        // Sobreposição <= 12 torna os eventos "14+" disjuntos: chance total = soma exata.
        maxOverlap: plan.kind === 'multiple-games' ? 11 : undefined,
        candidates: plan.kind === 'multiple-games' ? Math.max(20000, plan.tickets * 1500) : 20000,
      });
      const odds = planOdds(games.map((g) => g.numbers), plan.betSize);
      const returns = planReturns(plan.betSize, games.length, plan.kind === 'multiple-games' ? games.length * this.betPrice : plan.cost, prizes, PRIZE_WINDOW);
      if (plan.kind !== 'multiple-games') return { ...plan, games, odds, returns };
      const prob = multipleGamesAtLeast14(games.map((g) => g.numbers));
      return { ...plan, tickets: games.length, cost: games.length * this.betPrice, probAtLeast14: prob, oneIn: Math.round(1 / prob.estimate), games, odds, returns };
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

  async backtest(dto: BacktestDto) {
    const draws = await this.requireDraws();
    return runBacktest(draws, {
      betSize: dto.betSize,
      testSize: dto.testSize,
      betPrice: this.betPrice,
      weights: dto.weights as Partial<StrategyWeights>,
    });
  }

  private async requireDraws(): Promise<Draw[]> {
    const draws = await this.draws.findAll();
    if (draws.length < 150) {
      throw new BadRequestException('Poucos concursos no banco. Rode a sincronização primeiro (POST /api/sync).');
    }
    return draws;
  }
}
