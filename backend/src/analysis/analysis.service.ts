import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Draw, LotteryGame } from '../common/lottery';
import { Semaphore } from '../common/concurrency';
import { AppConfig } from '../config/configuration';
import { DrawsService } from '../draws/draws.service';
import { probabilityTable } from '../strategy/probability';
import { DEFAULT_WEIGHTS, StrategyWeights } from '../strategy/strategy.engine';
import {
  distribution,
  gameProfile,
  numberStats,
  rangeStat,
  repeatsFromPrevious,
  uniformityTest,
} from '../statistics/statistics';
import { BacktestDto, CheckDto, PlanDto, RecentCheckDto, SuggestDto, WeightsDto } from './analysis.dto';
import { checkBet, validateBets } from '../check/check.engine';
import { TaskArgs, TaskName, TaskResult, TASKS } from './analysis.tasks';

// Compilado (dist) existe o .js do worker; rodando via ts-node/ts-jest a tarefa roda inline.
const WORKER_PATH = join(__dirname, 'analysis.worker.js');

@Injectable()
export class AnalysisService {
  private readonly useWorker = existsSync(WORKER_PATH);
  /** Limita threads simultâneas: requisições excedentes esperam na fila em vez de saturar a CPU. */
  private readonly slots = new Semaphore(Math.max(1, availableParallelism() - 1));

  constructor(
    private readonly draws: DrawsService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private betPrice(game: LotteryGame): number {
    return this.config.get('betPrices', { infer: true })[game.id];
  }

  async summary(game: LotteryGame) {
    const draws = await this.requireDraws(game);
    const profiles = draws.map((d) => gameProfile(game, d.numbers));
    const repeats = repeatsFromPrevious(draws);
    // Faixas de soma de 10 em 10 (em todos os jogos).
    const sumBuckets = profiles.map((p) => Math.floor(p.sum / 10) * 10);
    return {
      totalDraws: draws.length,
      first: { concurso: draws[0].concurso, date: draws[0].date },
      last: draws[draws.length - 1],
      recentWindow: game.recentWindow,
      numbers: numberStats(game, draws),
      profiles: {
        sum: { ...rangeStat(profiles.map((p) => p.sum)), distribution: distribution(sumBuckets) },
        odds: { ...rangeStat(profiles.map((p) => p.odds)), distribution: distribution(profiles.map((p) => p.odds)) },
        primes: { ...rangeStat(profiles.map((p) => p.primes)), distribution: distribution(profiles.map((p) => p.primes)) },
        frame: { ...rangeStat(profiles.map((p) => p.frame)), distribution: distribution(profiles.map((p) => p.frame)) },
        repeats: { ...rangeStat(repeats), distribution: distribution(repeats) },
      },
      uniformity: uniformityTest(game, draws),
    };
  }

  probabilities(game: LotteryGame) {
    const betPrice = this.betPrice(game);
    return { betPrice, rows: probabilityTable(game, betPrice) };
  }

  async suggest(game: LotteryGame, dto: SuggestDto) {
    return this.run(game, 'suggest', await this.requireDraws(game), {
      betSize: dto.betSize,
      games: dto.games,
      seed: dto.seed,
      weights: explicitWeights(dto.weights),
    });
  }

  async plan(game: LotteryGame, dto: PlanDto) {
    return this.run(game, 'plan', await this.requireDraws(game), {
      budget: dto.budget,
      betPrice: this.betPrice(game),
      weights: explicitWeights(dto.weights),
    });
  }

  async backtest(game: LotteryGame, dto: BacktestDto) {
    return this.run(game, 'backtest', await this.requireDraws(game), {
      betSize: dto.betSize,
      testSize: dto.testSize,
      budget: dto.budget,
      betPrice: this.betPrice(game),
      weights: explicitWeights(dto.weights),
    });
  }

  /** Pesos em uso: sempre os padrão (a conferência não recalibra; ver check.engine). */
  currentWeights(): StrategyWeights {
    return { ...DEFAULT_WEIGHTS };
  }

  /** Confere apostas contra um concurso (padrão: o último) e explica os erros. */
  async check(game: LotteryGame, dto: CheckDto) {
    // Valida antes de consultar a Caixa (que abre um navegador).
    const error = validateBets(game, dto.bets);
    if (error) throw new BadRequestException(error);
    const official = dto.official ? await this.draws.fetchOfficialLatest(game) : null;
    const draws = await this.requireDraws(game);
    const concurso = official?.concurso ?? dto.concurso ?? draws[draws.length - 1].concurso;
    if (!draws.some((d) => d.concurso === concurso)) throw new NotFoundException(`Concurso ${concurso} não encontrado`);
    const result = await this.run(game, 'check', draws, {
      bets: dto.bets,
      concurso,
      betPrice: this.betPrice(game),
    });
    await this.draws.saveChecks(game, concurso, result.bets);
    return result;
  }

  /** Confere as apostas em cada um dos últimos concursos oficiais (só conferência, sem recalibrar). */
  async checkRecent(game: LotteryGame, dto: RecentCheckDto) {
    const error = validateBets(game, dto.bets);
    if (error) throw new BadRequestException(error);
    const draws = await this.draws.fetchOfficialRecent(game, dto.count);
    const betPrice = this.betPrice(game);
    const rows = draws.map((draw) => {
      const bets = dto.bets.map((b) => checkBet(game, draw, b, betPrice));
      const prize = bets.reduce((a, b) => a + b.prize, 0);
      return { draw, bets, bestHits: Math.max(...bets.map((b) => b.hits)), prize };
    });
    const costPerDraw = rows[0]?.bets.reduce((a, b) => a + b.cost, 0) ?? 0;
    const cost = Number((costPerDraw * rows.length).toFixed(2));
    const prize = rows.reduce((a, r) => a + r.prize, 0);
    return { rows, totals: { cost, prize, net: Number((prize - cost).toFixed(2)), winningDraws: rows.filter((r) => r.prize > 0).length } };
  }

  /** Roda a tarefa num worker thread (não bloqueia a API); erros de domínio viram 400. */
  private async run<K extends TaskName>(game: LotteryGame, task: K, draws: Draw[], args: TaskArgs<K>): Promise<TaskResult<K>> {
    const gameId = game.id;
    try {
      if (!this.useWorker) return (TASKS[task] as (g: typeof gameId, d: Draw[], a: TaskArgs<K>) => TaskResult<K>)(gameId, draws, args);
      return await this.slots.run(() => new Promise<TaskResult<K>>((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, { workerData: { task, gameId, draws, args } });
        worker.once('message', (msg: { ok: true; result: TaskResult<K> } | { ok: false; name: string; message: string }) => {
          if (msg.ok) return resolve(msg.result);
          reject(msg.name === 'RangeError' ? new RangeError(msg.message) : new Error(msg.message));
        });
        worker.once('error', reject);
        worker.once('exit', (code) => code !== 0 && reject(new Error(`Worker de análise saiu com código ${code}`)));
      }));
    } catch (error) {
      if (error instanceof RangeError || /insuficiente/i.test((error as Error).message)) {
        throw new BadRequestException((error as Error).message);
      }
      throw error;
    }
  }

  private async requireDraws(game: LotteryGame): Promise<Draw[]> {
    const draws = await this.draws.findAll(game);
    if (draws.length < 150) {
      throw new BadRequestException(`Poucos concursos da ${game.name} no banco. Clique em "Atualizar resultados" (POST /api/${game.id}/sync).`);
    }
    return draws;
  }
}

/** Pesos enviados na requisição; campos ausentes chegam como undefined e não podem apagar os padrão. */
function explicitWeights(override: WeightsDto | undefined): Partial<StrategyWeights> {
  return Object.fromEntries(Object.entries(override ?? {}).filter(([, v]) => v !== undefined));
}
