import { z } from 'zod';
import { GameId } from '../common/lottery';

/** Senha de desenvolvimento (a mesma do docker-compose). Proibida em produção. */
export const DEV_NEO4J_PASSWORD = 'lotofacil123';

const schema = z
  .object({
    NODE_ENV: z.string().default('development'),
    PORT: z.coerce.number().int().positive().default(3100),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    NEO4J_URI: z.string().default('bolt://localhost:7687'),
    NEO4J_USER: z.string().default('neo4j'),
    NEO4J_PASSWORD: z.string().min(1).default(DEV_NEO4J_PASSWORD),
    SCRAPE_FROM_CONCURSO: z.coerce.number().int().positive().default(1),
    SCRAPE_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
    BET_PRICE: z.coerce.number().positive().default(3.5),
    MEGASENA_BET_PRICE: z.coerce.number().positive().default(6),
    QUINA_BET_PRICE: z.coerce.number().positive().default(3),
    DIADESORTE_BET_PRICE: z.coerce.number().positive().default(2.5),
    SYNC_ON_STARTUP: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .refine((e) => e.NODE_ENV !== 'production' || e.NEO4J_PASSWORD !== DEV_NEO4J_PASSWORD, {
    path: ['NEO4J_PASSWORD'],
    message: 'defina uma senha própria em produção (a padrão de desenvolvimento não é permitida)',
  });

export interface AppConfig {
  port: number;
  corsOrigin: string;
  neo4j: { uri: string; user: string; password: string };
  scrapeFromConcurso: number;
  scrapeConcurrency: number;
  /** Preço da aposta simples de cada jogo (R$). */
  betPrices: Record<GameId, number>;
  syncOnStartup: boolean;
}

export function loadConfig(env: Record<string, unknown> = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Configuração inválida: ${parsed.error.issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
  const e = parsed.data;
  return {
    port: e.PORT,
    corsOrigin: e.CORS_ORIGIN,
    neo4j: { uri: e.NEO4J_URI, user: e.NEO4J_USER, password: e.NEO4J_PASSWORD },
    scrapeFromConcurso: e.SCRAPE_FROM_CONCURSO,
    scrapeConcurrency: e.SCRAPE_CONCURRENCY,
    betPrices: { lotofacil: e.BET_PRICE, megasena: e.MEGASENA_BET_PRICE, quina: e.QUINA_BET_PRICE, diadesorte: e.DIADESORTE_BET_PRICE },
    syncOnStartup: e.SYNC_ON_STARTUP,
  };
}
