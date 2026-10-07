import { ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Draw, GAMES, LotteryGame } from '../common/lottery';
import { AppConfig } from '../config/configuration';
import { numberEmbeddings, ppmiMatrix } from '../embeddings/embeddings';
import { ScraperService } from '../scraper/scraper.service';
import { cooccurrenceMatrix } from '../statistics/statistics';
import { DrawsRepository, SimilarDraw } from './draws.repository';

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

const idleStatus = (): SyncStatus => ({
  state: 'idle',
  startedAt: null,
  finishedAt: null,
  total: 0,
  processed: 0,
  imported: 0,
  failed: [],
  latestConcurso: null,
  message: null,
});

/** Concursos e sincronização de cada jogo; estado (cache e status) separado por jogo. */
@Injectable()
export class DrawsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DrawsService.name);
  private readonly cache = new Map<string, Draw[]>();
  private readonly status = new Map<string, SyncStatus>();

  constructor(
    private readonly repository: DrawsRepository,
    private readonly scraper: ScraperService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get('syncOnStartup', { infer: true })) return;
    // Um jogo por vez: cada sincronização abre seu próprio Chromium.
    void (async () => {
      for (const game of Object.values(GAMES)) {
        // Pula o jogo cuja sincronização já foi iniciada manualmente (evita duas em paralelo).
        if (this.getSyncStatus(game).state === 'running') continue;
        await this.runSync(game);
      }
    })();
  }

  getSyncStatus(game: LotteryGame): SyncStatus {
    return { ...(this.status.get(game.id) ?? idleStatus()) };
  }

  private setStatus(game: LotteryGame, patch: Partial<SyncStatus>): void {
    this.status.set(game.id, { ...(this.status.get(game.id) ?? idleStatus()), ...patch });
  }

  /** Inicia a sincronização incremental em background. */
  startSync(game: LotteryGame): SyncStatus {
    if (this.getSyncStatus(game).state === 'running') throw new ConflictException('Sincronização já em andamento');
    void this.runSync(game);
    return this.getSyncStatus(game);
  }

  /**
   * Marca o jogo como "running" (de forma síncrona, antes do primeiro await) e sincroniza;
   * uma falha vira status "error" em vez de deixar o jogo travado em "running".
   */
  private async runSync(game: LotteryGame): Promise<void> {
    this.status.set(game.id, { ...idleStatus(), state: 'running', startedAt: new Date().toISOString(), message: 'Consultando último concurso…' });
    try {
      await this.sync(game);
    } catch (error) {
      const e = error as Error;
      this.logger.error(`${game.name}: sincronização falhou: ${e.message}`, e.stack);
      this.setStatus(game, { state: 'error', finishedAt: new Date().toISOString(), message: e.message });
    }
  }

  /** Executa a sincronização e aguarda o término (usado pela CLI). */
  async sync(game: LotteryGame): Promise<SyncStatus> {
    this.setStatus(game, { state: 'running' });
    const failed: number[] = [];
    let imported = 0;
    let missingCount = 0;
    await this.scraper.withSession(game, async (session) => {
      const latest = await session.fetchLatestConcurso();
      const from = this.config.get('scrapeFromConcurso', { infer: true });
      const existing = new Set(await this.repository.existingConcursos(game));
      const missing: number[] = [];
      for (let c = from; c <= latest; c++) if (!existing.has(c)) missing.push(c);
      missingCount = missing.length;

      this.setStatus(game, { latestConcurso: latest, total: missing.length, message: `Baixando ${missing.length} concursos…` });
      this.logger.log(`${game.name}: último concurso ${latest}; faltando ${missing.length}`);

      // Persiste em lotes: uma falha no meio não perde o que já foi baixado.
      try {
        for (let i = 0; i < missing.length; i += SYNC_CHUNK) {
          const chunk = missing.slice(i, i + SYNC_CHUNK);
          const result = await session.fetchConcursos(chunk);
          await this.repository.upsertMany(game, result.draws);
          failed.push(...result.failed);
          imported += result.draws.length;
          this.setStatus(game, { processed: i + chunk.length, imported, failed: [...failed] });
        }
      } finally {
        // Lotes já gravados devem aparecer mesmo se um lote posterior falhar.
        if (imported > 0) this.cache.delete(game.id);
      }
    });
    await this.repository.linkSequence(game);
    await this.refreshNumberGraph(game);

    this.setStatus(game, {
      state: 'done',
      processed: missingCount,
      finishedAt: new Date().toISOString(),
      message: failed.length
        ? `${imported} importados, ${failed.length} falharam (rode novamente para tentar de novo)`
        : `${imported} concursos importados`,
    });
    return this.getSyncStatus(game);
  }

  /** Consulta o último resultado no portal da Caixa e o grava se ainda não estiver no banco. */
  async fetchOfficialLatest(game: LotteryGame): Promise<Draw> {
    return (await this.fetchOfficialRecent(game, 1))[0];
  }

  /**
   * Os `count` concursos mais recentes segundo o portal da Caixa (mais recente primeiro).
   * Baixa e grava os que faltam no banco, para não haver buracos na sequência.
   */
  async fetchOfficialRecent(game: LotteryGame, count: number): Promise<Draw[]> {
    const fresh = await this.scraper.withSession(game, async (session) => {
      const latest = await session.fetchLatestDraw();
      const existing = new Set((await this.findAll(game)).map((d) => d.concurso));
      const missing: number[] = [];
      for (let c = Math.max(1, latest.concurso - count + 1); c < latest.concurso; c++) if (!existing.has(c)) missing.push(c);
      const { draws } = await session.fetchConcursos(missing);
      return existing.has(latest.concurso) ? draws : [...draws, latest];
    });
    if (fresh.length > 0) {
      await this.repository.upsertMany(game, fresh);
      await this.repository.linkSequence(game);
      this.cache.delete(game.id);
    }
    return [...(await this.findAll(game))].reverse().slice(0, count);
  }

  async findAll(game: LotteryGame): Promise<Draw[]> {
    let draws = this.cache.get(game.id);
    if (!draws) {
      draws = await this.repository.findAll(game);
      this.cache.set(game.id, draws);
    }
    return draws;
  }

  async findPage(game: LotteryGame, page: number, pageSize: number): Promise<{ items: Draw[]; total: number }> {
    const all = await this.findAll(game);
    const desc = [...all].reverse();
    return { items: desc.slice((page - 1) * pageSize, page * pageSize), total: all.length };
  }

  async findOne(game: LotteryGame, concurso: number): Promise<Draw> {
    const draw = (await this.findAll(game)).find((d) => d.concurso === concurso);
    if (!draw) throw new NotFoundException(`Concurso ${concurso} da ${game.name} não encontrado`);
    return draw;
  }

  async findSimilar(game: LotteryGame, concurso: number, k: number): Promise<SimilarDraw[]> {
    await this.findOne(game, concurso);
    return this.repository.findSimilar(game, concurso, k);
  }

  topPairs(game: LotteryGame, limit: number, orderBy: 'count' | 'ppmi') {
    return this.repository.topPairs(game, limit, orderBy);
  }

  saveChecks(game: LotteryGame, concurso: number, bets: Array<{ numbers: number[]; hits: number; prize: number }>) {
    return this.repository.saveChecks(game, concurso, bets);
  }

  private async refreshNumberGraph(game: LotteryGame): Promise<void> {
    const draws = await this.findAll(game);
    if (draws.length === 0) return;
    const cooc = cooccurrenceMatrix(game, draws);
    await this.repository.saveNumberGraph(game, cooc, ppmiMatrix(cooc, draws.length), numberEmbeddings(cooc, draws.length));
  }
}
