import { ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Draw } from '../common/lottery';
import { AppConfig } from '../config/configuration';
import { numberEmbeddings, ppmiMatrix } from '../embeddings/embeddings';
import { ScraperService } from '../scraper/scraper.service';
import { cooccurrenceMatrix } from '../statistics/statistics';
import { DrawsRepository, SimilarDraw } from './draws.repository';
import { StrategyWeights } from '../strategy/strategy.engine';

const SYNC_CHUNK = 250;

export type SyncState = 'idle' | 'running' | 'done' | 'error';

export interface SyncStatus {
  state: SyncState;
  startedAt: string | null;
  finishedAt: string | null;
  total: number;
  processed: number;
  imported: number;
  failed: number[];
  latestConcurso: number | null;
  message: string | null;
}

@Injectable()
export class DrawsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DrawsService.name);
  private cache: Draw[] | null = null;
  private status: SyncStatus = {
    state: 'idle',
    startedAt: null,
    finishedAt: null,
    total: 0,
    processed: 0,
    imported: 0,
    failed: [],
    latestConcurso: null,
    message: null,
  };

  constructor(
    private readonly repository: DrawsRepository,
    private readonly scraper: ScraperService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get('syncOnStartup', { infer: true })) void this.startSync();
  }

  getSyncStatus(): SyncStatus {
    return { ...this.status };
  }

  /** Inicia a sincronização incremental em background. */
  startSync(): SyncStatus {
    if (this.status.state === 'running') throw new ConflictException('Sincronização já em andamento');
    this.status = {
      state: 'running',
      startedAt: new Date().toISOString(),
      finishedAt: null,
      total: 0,
      processed: 0,
      imported: 0,
      failed: [],
      latestConcurso: null,
      message: 'Consultando último concurso…',
    };
    void this.sync().catch((error: Error) => {
      this.logger.error(`Sincronização falhou: ${error.message}`, error.stack);
      this.status = { ...this.status, state: 'error', finishedAt: new Date().toISOString(), message: error.message };
    });
    return this.getSyncStatus();
  }

  /** Executa a sincronização e aguarda o término (usado pela CLI). */
  async sync(): Promise<SyncStatus> {
    this.status.state = 'running';
    const failed: number[] = [];
    let imported = 0;
    let missingCount = 0;
    await this.scraper.withSession(async (session) => {
      const latest = await session.fetchLatestConcurso();
      const from = this.config.get('scrapeFromConcurso', { infer: true });
      const existing = new Set(await this.repository.existingConcursos());
      const missing: number[] = [];
      for (let c = from; c <= latest; c++) if (!existing.has(c)) missing.push(c);
      missingCount = missing.length;

      this.status = { ...this.status, latestConcurso: latest, total: missing.length, message: `Baixando ${missing.length} concursos…` };
      this.logger.log(`Último concurso ${latest}; faltando ${missing.length}`);

      // Persiste em lotes: uma falha no meio não perde o que já foi baixado.
      try {
        for (let i = 0; i < missing.length; i += SYNC_CHUNK) {
          const chunk = missing.slice(i, i + SYNC_CHUNK);
          const result = await session.fetchConcursos(chunk);
          await this.repository.upsertMany(result.draws);
          failed.push(...result.failed);
          imported += result.draws.length;
          this.status = { ...this.status, processed: i + chunk.length, imported, failed: [...failed] };
        }
      } finally {
        // Lotes já gravados devem aparecer mesmo se um lote posterior falhar.
        if (imported > 0) this.cache = null;
      }
    });
    await this.repository.linkSequence();
    await this.refreshNumberGraph();

    this.status = {
      ...this.status,
      state: 'done',
      processed: missingCount,
      finishedAt: new Date().toISOString(),
      message: failed.length
        ? `${imported} importados, ${failed.length} falharam (rode novamente para tentar de novo)`
        : `${imported} concursos importados`,
    };
    return this.getSyncStatus();
  }

  async findAll(): Promise<Draw[]> {
    if (!this.cache) this.cache = await this.repository.findAll();
    return this.cache;
  }

  async findPage(page: number, pageSize: number): Promise<{ items: Draw[]; total: number }> {
    const all = await this.findAll();
    const desc = [...all].reverse();
    return { items: desc.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  }

  async findOne(concurso: number): Promise<Draw> {
    const draw = (await this.findAll()).find((d) => d.concurso === concurso);
    if (!draw) throw new NotFoundException(`Concurso ${concurso} não encontrado`);
    return draw;
  }

  async findSimilar(concurso: number, k: number): Promise<SimilarDraw[]> {
    await this.findOne(concurso);
    return this.repository.findSimilar(concurso, k);
  }

  topPairs(limit: number, orderBy: 'count' | 'ppmi') {
    return this.repository.topPairs(limit, orderBy);
  }

  loadModelWeights() {
    return this.repository.loadModelWeights();
  }

  saveModelWeights(weights: Partial<StrategyWeights>, basedOnConcurso: number) {
    return this.repository.saveModelWeights(weights, basedOnConcurso);
  }

  saveChecks(concurso: number, bets: Array<{ numbers: number[]; hits: number; prize: number }>) {
    return this.repository.saveChecks(concurso, bets);
  }

  private async refreshNumberGraph(): Promise<void> {
    const draws = await this.findAll();
    if (draws.length === 0) return;
    const cooc = cooccurrenceMatrix(draws);
    await this.repository.saveNumberGraph(cooc, ppmiMatrix(cooc, draws.length), numberEmbeddings(cooc, draws.length));
  }
}
