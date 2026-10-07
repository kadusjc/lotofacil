import { loadConfig } from './configuration';

describe('config', () => {
  it('applies defaults', () => {
    const c = loadConfig({});
    expect(c.port).toBe(3100);
    expect(c.betPrices).toEqual({ lotofacil: 3.5, megasena: 6, quina: 3, diadesorte: 2.5 });
    expect(c.syncOnStartup).toBe(false);
  });
  it('rejects invalid values', () => expect(() => loadConfig({ SCRAPE_CONCURRENCY: '99' })).toThrow(/inválida/));
  it('forbids the dev Neo4j password in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/NEO4J_PASSWORD/);
    expect(loadConfig({ NODE_ENV: 'production', NEO4J_PASSWORD: 's3cr3t' }).neo4j.password).toBe('s3cr3t');
  });
});
