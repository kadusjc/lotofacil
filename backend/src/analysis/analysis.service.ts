import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Draw } from '../common/lottery';
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
import { BacktestDto, CheckDto, PlanDto, SuggestDto, WeightsDto } from './analysis.dto';
import { TaskArgs, TaskName, TaskResult, TASKS } from './analysis.tasks';

// Compilado (dist) existe o .js do worker; rodando via ts-node/ts-jest a tarefa roda inline.
const WORKER_PATH = join(__dirname, 'analysis.worker.js');

@Injectable()
export class AnalysisService {
  private readonly useWorker = existsSync(WORKER_PATH);
  /** Limita threads simultâneas: requisições excedentes esperam na fila em vez de saturar a CPU. */
  private readonly slots = new Semaphore(Math.max(1, availableParallelism() - 1));
  private learned: Partial<StrategyWeights> | null | undefined;

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
    return this.run('suggest', await this.requireDraws(), {
      betSize: dto.betSize,
      games: dto.games,
      seed: dto.seed,
      weights: await this.weights(dto.weights),
    });
  }

  async plan(dto: PlanDto) {
    return this.run('plan', await this.requireDraws(), {
      budget: dto.budget,
      betPrice: this.betPrice,
      weights: await this.weights(dto.weights),
    });
  }

  async backtest(dto: BacktestDto) {
    return this.run('backtest', await this.requireDraws(), {
      betSize: dto.betSize,
      testSize: dto.testSize,
      budget: dto.budget,
      betPrice: this.betPrice,
      weights: await this.weights(dto.weights),
    });
  }

  /** Pesos em uso: padrão, sobrescritos pelos calibrados e, por fim, pelos enviados na requisição. */
  async currentWeights(): Promise<StrategyWeights> {
    return { ...DEFAULT_WEIGHTS, ...(await this.weights(undefined)) };
  }

  /** Confere apostas contra um concurso (padrão: o último), explica os erros e recalibra os pesos. */
  async check(dto: CheckDto) {
    const draws = await this.requireDraws();
    const concurso = dto.concurso ?? draws[draws.length - 1].concurso;
    if (!draws.some((d) => d.concurso === concurso)) throw new NotFoundException(`Concurso ${concurso} não encontrado`);
    const result = await this.run('check', draws, {
      bets: dto.bets,
      concurso,
      betPrice: this.betPrice,
      previousWeights: await this.currentWeights(),
    });
    await this.draws.saveChecks(concurso, result.bets);
    await this.draws.saveModelWeights(result.learnedWeights, draws[draws.length - 1].concurso);
    this.learned = result.learnedWeights;
    return result;
  }

  private async weights(override: WeightsDto | undefined): Promise<Partial<StrategyWeights>> {
    if (this.learned === undefined) this.learned = sanitizeWeights(await this.draws.loadModelWeights());
    // Campos ausentes do DTO chegam como undefined e não podem apagar os pesos calibrados.
    const explicit = Object.fromEntries(Object.entries(override ?? {}).filter(([, v]) => v !== undefined));
    return { ...this.learned, ...explicit };
  }

  /** Roda a tarefa num worker thread (não bloqueia a API); erros de domínio viram 400. */
  private async run<K extends TaskName>(task: K, draws: Draw[], args: TaskArgs<K>): Promise<TaskResult<K>> {
    try {
      if (!this.useWorker) return (TASKS[task] as (d: Draw[], a: TaskArgs<K>) => TaskResult<K>)(draws, args);
      return await this.slots.run(() => new Promise<TaskResult<K>>((resolve, reject) => {
        const worker = new Worker(WORKER_PATH, { workerData: { task, draws, args } });
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

  private async requireDraws(): Promise<Draw[]> {
    const draws = await this.draws.findAll();
    if (draws.length < 150) {
      throw new BadRequestException('Poucos concursos no banco. Rode a sincronização primeiro (POST /api/sync).');
    }
    return draws;
  }
}

/** Pesos lidos do banco: mantém só sinais conhecidos com valores finitos e não negativos. */
function sanitizeWeights(raw: Partial<StrategyWeights> | null): Partial<StrategyWeights> | null {
  if (!raw) return null;
  const known = Object.keys(DEFAULT_WEIGHTS) as Array<keyof StrategyWeights>;
  return Object.fromEntries(
    known.filter((k) => Number.isFinite(raw[k]) && (raw[k] as number) >= 0).map((k) => [k, raw[k]]),
  ) as Partial<StrategyWeights>;
}
