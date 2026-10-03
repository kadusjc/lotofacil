import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Browser, BrowserContext, chromium } from 'playwright';
import { Draw } from '../common/lottery';
import { mapWithConcurrency, withRetry } from '../common/concurrency';
import { AppConfig } from '../config/configuration';
import { CaixaLotofacilResponse, parseCaixaResponse } from './caixa.parser';

export const CAIXA_PORTAL_URL = 'https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx';
export const CAIXA_API_URL = 'https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil';

export interface FetchResult {
  draws: Draw[];
  failed: number[];
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

  async fetchLatestConcurso(): Promise<number> {
    return this.withBrowser(async (context) => {
      const latest = await this.fetchJson(context, `${CAIXA_API_URL}/`);
      return latest.numero;
    });
  }

  async fetchConcursos(concursos: number[], onProgress?: (done: number, total: number) => void): Promise<FetchResult> {
    if (concursos.length === 0) return { draws: [], failed: [] };
    const concurrency = this.config.get('scrapeConcurrency', { infer: true });
    return this.withBrowser(async (context) => {
      const failed: number[] = [];
      let done = 0;
      const results = await mapWithConcurrency(concursos, concurrency, async (concurso) => {
        try {
          const payload = await withRetry(() => this.fetchJson(context, `${CAIXA_API_URL}/${concurso}`));
          return parseCaixaResponse(payload);
        } catch (error) {
          this.logger.warn(`Falha no concurso ${concurso}: ${(error as Error).message}`);
          failed.push(concurso);
          return null;
        } finally {
          done++;
          if (done % 100 === 0 || done === concursos.length) onProgress?.(done, concursos.length);
        }
      });
      return { draws: results.filter((d): d is Draw => d !== null), failed: failed.sort((a, b) => a - b) };
    });
  }

  private async fetchJson(context: BrowserContext, url: string): Promise<CaixaLotofacilResponse> {
    const response = await context.request.get(url, {
      headers: { accept: 'application/json' },
      timeout: 20_000,
    });
    if (!response.ok()) throw new Error(`HTTP ${response.status()} em ${url}`);
    return (await response.json()) as CaixaLotofacilResponse;
  }

  private async withBrowser<T>(fn: (context: BrowserContext) => Promise<T>): Promise<T> {
    let browser: Browser | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ locale: 'pt-BR' });
      const page = await context.newPage();
      try {
        await page.goto(CAIXA_PORTAL_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
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
