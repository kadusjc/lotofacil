import { z } from 'zod';

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3100),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  NEO4J_URI: z.string().default('bolt://localhost:7687'),
  NEO4J_USER: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().min(1).default('lotofacil123'),
  SCRAPE_FROM_CONCURSO: z.coerce.number().int().positive().default(1),
  SCRAPE_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(4),
  BET_PRICE: z.coerce.number().positive().default(3.5),
  SYNC_ON_STARTUP: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export interface AppConfig {
  port: number;
  corsOrigin: string;
  neo4j: { uri: string; user: string; password: string };
  scrapeFromConcurso: number;
  scrapeConcurrency: number;
  betPrice: number;
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
    betPrice: e.BET_PRICE,
    syncOnStartup: e.SYNC_ON_STARTUP,
  };
}
