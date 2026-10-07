import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Browser, BrowserContext, chromium } from 'playwright';
import { Draw, LotteryGame } from '../common/lottery';
import { mapWithConcurrency, withRetry } from '../common/concurrency';
import { AppConfig } from '../config/configuration';
import { CaixaResponse, parseCaixaResponse } from './caixa.parser';

export const CAIXA_API_BASE = 'https://servicebus2.caixa.gov.br/portaldeloterias/api';

export function caixaApiUrl(game: LotteryGame): string {
  return `${CAIXA_API_BASE}/${game.caixaSlug}`;
}

export interface FetchResult {
  draws: Draw[];
  failed: number[];
}

/** Sessão aberta no portal: um único Chromium reaproveitado por todas as consultas. */
export interface ScraperSession {
  fetchLatestConcurso(): Promise<number>;
  /** Resultado completo do concurso mais recente publicado no portal. */
  fetchLatestDraw(): Promise<Draw>;
  fetchConcursos(concursos: number[], onProgress?: (done: number, total: number) => void): Promise<FetchResult>;
}

/**
 * Coleta resultados com Playwright: abre o portal num Chromium real (obtém cookies/sessão
 * como um navegador) e usa o APIRequestContext do mesmo contexto para buscar o JSON de cada
 * concurso — mais robusto contra bloqueios do que requisições HTTP "cruas".
 */
@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  /** Abre o navegador uma vez, executa `fn` e fecha ao final (mesmo em caso de erro). */
  async withSession<T>(game: LotteryGame, fn: (session: ScraperSession) => Promise<T>): Promise<T> {
    const api = caixaApiUrl(game);
    return this.withBrowser(game, (context) =>
      fn({
        fetchLatestConcurso: () => this.fetchLatestConcurso(context, api),
        fetchLatestDraw: async () => parseCaixaResponse(game, await withRetry(() => this.fetchJson(context, `${api}/`))),
        fetchConcursos: (concursos, onProgress) => this.fetchConcursos(game, context, api, concursos, onProgress),
      }),
    );
  }

  private async fetchLatestConcurso(context: BrowserContext, api: string): Promise<number> {
    const latest = await withRetry(() => this.fetchJson(context, `${api}/`));
    // Sem essa checagem, uma resposta inesperada viraria "0 concursos faltando" silenciosamente.
    if (!Number.isInteger(latest?.numero) || latest.numero < 1) {
      throw new Error(`Resposta inválida ao consultar o último concurso: ${JSON.stringify(latest).slice(0, 200)}`);
    }
    return latest.numero;
  }

  private async fetchConcursos(
    game: LotteryGame,
    context: BrowserContext,
    api: string,
    concursos: number[],
    onProgress?: (done: number, total: number) => void,
  ): Promise<FetchResult> {
    if (concursos.length === 0) return { draws: [], failed: [] };
    const concurrency = this.config.get('scrapeConcurrency', { infer: true });
    const failed: number[] = [];
    let done = 0;
    const results = await mapWithConcurrency(concursos, concurrency, async (concurso) => {
      try {
        const payload = await withRetry(() => this.fetchJson(context, `${api}/${concurso}`));
        return parseCaixaResponse(game, payload);
      } catch (error) {
        this.logger.warn(`${game.name}: falha no concurso ${concurso}: ${(error as Error).message}`);
        failed.push(concurso);
        return null;
      } finally {
        done++;
        if (done % 100 === 0 || done === concursos.length) onProgress?.(done, concursos.length);
      }
    });
    return { draws: results.filter((d): d is Draw => d !== null), failed: failed.sort((a, b) => a - b) };
  }

  private async fetchJson(context: BrowserContext, url: string): Promise<CaixaResponse> {
    const response = await context.request.get(url, {
      headers: { accept: 'application/json' },
      timeout: 20_000,
    });
    if (!response.ok()) throw new Error(`HTTP ${response.status()} em ${url}`);
    return (await response.json()) as CaixaResponse;
  }

  private async withBrowser<T>(game: LotteryGame, fn: (context: BrowserContext) => Promise<T>): Promise<T> {
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ locale: 'pt-BR' });
      const page = await context.newPage();
      try {
        await page.goto(game.portalUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      } catch (error) {
        // O portal pode estar lento; a API costuma responder mesmo assim.
        this.logger.warn(`Portal indisponível, seguindo direto para a API: ${(error as Error).message}`);
      }
      return await fn(context);
    } finally {
      await browser?.close();
    }
  }
}
